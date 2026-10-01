<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

// Billing & professional fees.
//   Admin : manages everything (bills + professional fees)
//   Staff : handles the bills for patients (create / edit / record payment),
//           but cannot add or remove professional fees
// NOTE: this app has no server-side sessions, so actingUserId comes from the
// client (same approach as users.php). It stops the UI/API being used casually
// by the wrong role, but it is not real authentication.
class Billing {

    private $allowedStatuses = ["Pending", "Paid", "Cancelled"];

    // Role name of an ACTIVE user, or null.
    private function roleOf($conn, $actingUserId) {
        if (empty($actingUserId)) return null;
        $stmt = $conn->prepare("SELECT r.RoleName FROM USERS u
                                JOIN ROLE r ON u.RoleID = r.RoleID
                                WHERE u.UserID = :id AND u.Status = 'Active'");
        $stmt->bindParam(":id", $actingUserId);
        $stmt->execute();
        $role = $stmt->fetchColumn();
        return $role === false ? null : $role;
    }

    private function canManageBills($conn, $actingUserId) {
        return in_array($this->roleOf($conn, $actingUserId), ["Admin", "Staff"], true);
    }

    private function isAdmin($conn, $actingUserId) {
        return $this->roleOf($conn, $actingUserId) === "Admin";
    }

    // Non-negative amount that fits DECIMAL(10,2)
    private function isValidAmount($v, $allowZero = true) {
        if (!is_numeric($v)) return false;
        $n = (float)$v;
        if ($n > 99999999.99) return false;
        return $allowZero ? $n >= 0 : $n > 0;
    }

    private function isValidDate($d) {
        $dt = DateTime::createFromFormat('Y-m-d', (string)$d);
        return $dt && $dt->format('Y-m-d') === $d;
    }

    // Get ALL bills — overview page (Admin + Staff)
    function getAllBills($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->canManageBills($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $sql = "SELECT b.BillID, b.ConsultationID, b.BillDate, b.TotalAmount, b.Status,
                       CONCAT(p.LastName, ', ', p.FirstName) AS PatientName,
                       CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName,
                       a.AppointmentDate
                FROM BILLING b
                JOIN CONSULTATION c  ON b.ConsultationID  = c.ConsultationID
                JOIN APPOINTMENT  a  ON c.AppointmentID   = a.AppointmentID
                JOIN PATIENT      p  ON a.PatientID       = p.PatientID
                JOIN USERS        u  ON a.UserID          = u.UserID
                ORDER BY b.BillDate DESC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Active consultations that don't have a bill yet — feeds the "Create Bill" picker
    function getUnbilledConsultations($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->canManageBills($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $sql = "SELECT c.ConsultationID, c.ConsultationDate,
                       CONCAT(p.LastName, ', ', p.FirstName) AS PatientName,
                       CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName
                FROM CONSULTATION c
                JOIN APPOINTMENT a ON c.AppointmentID = a.AppointmentID
                JOIN PATIENT     p ON a.PatientID     = p.PatientID
                JOIN USERS       u ON a.UserID        = u.UserID
                WHERE c.Status = 'Active'
                  AND NOT EXISTS (SELECT 1 FROM BILLING b WHERE b.ConsultationID = c.ConsultationID)
                ORDER BY c.ConsultationDate DESC, p.LastName, p.FirstName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Get billing record for a consultation (with professional fees)
    function getBillingByConsultation($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT b.BillID, b.ConsultationID, b.BillDate, b.TotalAmount, b.Status
                FROM BILLING b
                WHERE b.ConsultationID = :consultationId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId", $json['consultationId']);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Get professional fees for a bill
    function getProfessionalFees($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT pf.ProfessionalFeeID, pf.BillID, pf.UserID, pf.FeeAmount, pf.Description, pf.Status,
                       CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName
                FROM PROFESSIONAL_FEE pf
                JOIN USERS u ON pf.UserID = u.UserID
                WHERE pf.BillID = :billId AND pf.Status = 'Active'";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":billId", $json['billId']);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Create a bill for a consultation (Admin or Staff — one bill per consultation)
    function insertBilling($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->canManageBills($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $consultationId = $json['consultationId'] ?? "";
        $billDate       = $json['billDate'] ?? "";
        $totalAmount    = $json['totalAmount'] ?? "";

        if ($consultationId === "" || $billDate === "" || $totalAmount === "") return json_encode(["error" => "missing_fields"]);
        if (!$this->isValidDate($billDate))      return json_encode(["error" => "invalid_date"]);
        if (!$this->isValidAmount($totalAmount)) return json_encode(["error" => "invalid_amount"]);

        // The consultation must exist and be Active
        $c = $conn->prepare("SELECT ConsultationID FROM CONSULTATION WHERE ConsultationID = :cid AND Status = 'Active'");
        $c->bindParam(":cid", $consultationId);
        $c->execute();
        if (!$c->fetch()) return json_encode(["error" => "consultation_not_found"]);

        // Guard: one bill per consultation
        $chk = $conn->prepare("SELECT BillID FROM BILLING WHERE ConsultationID = :cid");
        $chk->bindParam(":cid", $consultationId);
        $chk->execute();
        if ($chk->fetch()) {
            return json_encode(["error" => "already_billed"]);
        }

        $sql = "INSERT INTO BILLING (ConsultationID, BillDate, TotalAmount, Status)
                VALUES (:consultationId, :billDate, :totalAmount, 'Pending')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId", $consultationId);
        $stmt->bindParam(":billDate",       $billDate);
        $stmt->bindParam(":totalAmount",    $totalAmount);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? ["billId" => $conn->lastInsertId()] : 0);
    }

    // Update billing date, total and status (Admin or Staff)
    function updateBilling($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->canManageBills($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $billId      = $json['billId'] ?? "";
        $billDate    = $json['billDate'] ?? "";
        $totalAmount = $json['totalAmount'] ?? "";
        $status      = $json['status'] ?? "";

        if ($billId === "" || $billDate === "" || $totalAmount === "") return json_encode(["error" => "missing_fields"]);
        if (!$this->isValidDate($billDate))      return json_encode(["error" => "invalid_date"]);
        if (!$this->isValidAmount($totalAmount)) return json_encode(["error" => "invalid_amount"]);
        if (!in_array($status, $this->allowedStatuses, true)) return json_encode(["error" => "invalid_status"]);

        $chk = $conn->prepare("SELECT BillID FROM BILLING WHERE BillID = :billId");
        $chk->bindParam(":billId", $billId);
        $chk->execute();
        if (!$chk->fetch()) return json_encode(["error" => "not_found"]);

        $sql = "UPDATE BILLING SET BillDate = :billDate, TotalAmount = :totalAmount, Status = :status
                WHERE BillID = :billId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":billDate",    $billDate);
        $stmt->bindParam(":totalAmount", $totalAmount);
        $stmt->bindParam(":status",      $status);
        $stmt->bindParam(":billId",      $billId);
        $stmt->execute();
        // MySQL reports 0 affected rows when nothing changed, which is still a successful save.
        return json_encode(1);
    }

    // Deactivate a bill (Admin only). Bills are never deleted - "deactivating"
    // sets Status = 'Cancelled', and restoreBilling puts it back to 'Pending'.
    function deactivateBilling($json) {
        return $this->setBillStatus($json, 'Cancelled');
    }

    function restoreBilling($json) {
        return $this->setBillStatus($json, 'Pending');
    }

    private function setBillStatus($json, $status) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->isAdmin($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $billId = $json['billId'] ?? "";
        if ($billId === "") return json_encode(["error" => "missing_fields"]);

        $chk = $conn->prepare("SELECT BillID FROM BILLING WHERE BillID = :billId");
        $chk->bindParam(":billId", $billId);
        $chk->execute();
        if (!$chk->fetch()) return json_encode(["error" => "not_found"]);

        $stmt = $conn->prepare("UPDATE BILLING SET Status = :status WHERE BillID = :billId");
        $stmt->bindParam(":status", $status);
        $stmt->bindParam(":billId", $billId);
        $stmt->execute();
        return json_encode(1);
    }

    // Add a professional fee line to a bill (Admin only)
    function insertProfessionalFee($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->isAdmin($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $billId    = $json['billId'] ?? "";
        $userId    = $json['userId'] ?? "";
        $feeAmount = $json['feeAmount'] ?? "";

        if ($billId === "" || $userId === "" || $feeAmount === "") return json_encode(["error" => "missing_fields"]);
        if (!$this->isValidAmount($feeAmount, false)) return json_encode(["error" => "invalid_amount"]);

        $chk = $conn->prepare("SELECT BillID FROM BILLING WHERE BillID = :billId");
        $chk->bindParam(":billId", $billId);
        $chk->execute();
        if (!$chk->fetch()) return json_encode(["error" => "not_found"]);

        $sql = "INSERT INTO PROFESSIONAL_FEE (BillID, UserID, FeeAmount, Description, Status)
                VALUES (:billId, :userId, :feeAmount, :description, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":billId",      $billId);
        $stmt->bindParam(":userId",      $userId);
        $stmt->bindParam(":feeAmount",   $feeAmount);
        $stmt->bindValue(":description", $json['description'] ?? null);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Remove a professional fee — soft delete (Admin only)
    function removeProfessionalFee($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->isAdmin($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $sql = "UPDATE PROFESSIONAL_FEE SET Status = 'Inactive' WHERE ProfessionalFeeID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['professionalFeeId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Get all active doctors for the fee dropdown
    function getActiveDoctors() {
        include "connection-pdo.php";
        $sql = "SELECT u.UserID, CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName
                FROM USERS u JOIN ROLE r ON u.RoleID = r.RoleID
                WHERE r.RoleName = 'Doctor' AND u.Status = 'Active'
                ORDER BY u.LastName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'];
    $json = isset($_GET['json']) ? $_GET['json'] : "";
} else {
    $operation = $_POST['operation'];
    $json = isset($_POST['json']) ? $_POST['json'] : "";
}

$billing = new Billing();
switch ($operation) {
    case "getAllBills":              echo $billing->getAllBills($json);              break;
    case "getUnbilledConsultations": echo $billing->getUnbilledConsultations($json); break;
    case "getBillingByConsultation": echo $billing->getBillingByConsultation($json); break;
    case "getProfessionalFees":      echo $billing->getProfessionalFees($json);      break;
    case "insertBilling":            echo $billing->insertBilling($json);            break;
    case "updateBilling":            echo $billing->updateBilling($json);            break;
    case "deactivateBilling":        echo $billing->deactivateBilling($json);        break;
    case "restoreBilling":           echo $billing->restoreBilling($json);           break;
    case "insertProfessionalFee":    echo $billing->insertProfessionalFee($json);    break;
    case "removeProfessionalFee":    echo $billing->removeProfessionalFee($json);    break;
    case "getActiveDoctors":         echo $billing->getActiveDoctors();              break;
}
?>
