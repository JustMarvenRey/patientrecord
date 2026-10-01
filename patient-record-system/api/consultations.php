<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Consultation {

    // Returns appointments + consultations for the consultations page.
    // APPOINTMENT.UserID is the doctor's USERS.UserID directly (per ERD).
    // - Admin/Staff: all appointments
    // - Doctor:      only appointments where a.UserID = signed-in UserID
    function getAppointmentsByDoctor($json) {
        include "connection-pdo.php";
        $json   = json_decode($json, true);
        $userId = $json['userId'];
        $role   = $json['role'];  // 'Admin' | 'Doctor' | 'Staff'

        if ($role === 'Doctor') {
            // APPOINTMENT.UserID is the doctor's UserID directly — no DOCTOR table needed
            $sql = "SELECT
                        a.AppointmentID,
                        a.PatientID,
                        CONCAT(p.LastName, ', ', p.FirstName) AS PatientName,
                        a.AppointmentDate,
                        a.AppointmentTime,
                        a.Reason,
                        a.Status  AS AppointmentStatus,
                        a.Notes   AS AppointmentNotes,
                        c.ConsultationID,
                        c.ConsultationDate,
                        c.ChiefComplaint,
                        c.Symptoms,
                        c.Treatment,
                        c.Notes   AS ConsultationNotes,
                        c.Status  AS ConsultationStatus
                    FROM APPOINTMENT a
                    JOIN PATIENT p ON a.PatientID = p.PatientID
                    LEFT JOIN CONSULTATION c ON c.AppointmentID = a.AppointmentID
                    WHERE a.UserID = :userId
                    ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":userId", $userId);
        } else {
            // Admin or Staff — see all appointments + doctor name
            $sql = "SELECT
                        a.AppointmentID,
                        a.PatientID,
                        CONCAT(p.LastName, ', ', p.FirstName) AS PatientName,
                        CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName,
                        a.AppointmentDate,
                        a.AppointmentTime,
                        a.Reason,
                        a.Status  AS AppointmentStatus,
                        a.Notes   AS AppointmentNotes,
                        c.ConsultationID,
                        c.ConsultationDate,
                        c.ChiefComplaint,
                        c.Symptoms,
                        c.Treatment,
                        c.Notes   AS ConsultationNotes,
                        c.Status  AS ConsultationStatus
                    FROM APPOINTMENT a
                    JOIN PATIENT p ON a.PatientID = p.PatientID
                    JOIN USERS   u ON a.UserID    = u.UserID
                    LEFT JOIN CONSULTATION c ON c.AppointmentID = a.AppointmentID
                    ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC";
            $stmt = $conn->prepare($sql);
        }

        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    // Single consultation by ConsultationID
    function getConsultation($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT c.*,
                       a.AppointmentDate,
                       a.AppointmentTime,
                       a.Reason,
                       CONCAT(p.LastName, ', ', p.FirstName) AS PatientName,
                       CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName
                FROM CONSULTATION c
                JOIN APPOINTMENT a ON c.AppointmentID = a.AppointmentID
                JOIN PATIENT     p ON a.PatientID      = p.PatientID
                JOIN USERS       u ON a.UserID          = u.UserID
                WHERE c.ConsultationID = :consultationId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId", $json['consultationId']);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    // Creates a new consultation linked to an appointment
    function insertConsultation($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);

        // Guard: one consultation per appointment
        $chk = $conn->prepare("SELECT ConsultationID FROM CONSULTATION WHERE AppointmentID = :apptId");
        $chk->bindParam(":apptId", $json['appointmentId']);
        $chk->execute();
        if ($chk->rowCount() > 0) {
            return json_encode(["error" => "already_has_consultation"]);
        }

        $sql = "INSERT INTO CONSULTATION
                    (AppointmentID, ConsultationDate, ChiefComplaint, Symptoms, Treatment, Notes, Status)
                VALUES
                    (:appointmentId, :consultationDate, :chiefComplaint, :symptoms, :treatment, :notes, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":appointmentId",    $json['appointmentId']);
        $stmt->bindParam(":consultationDate", $json['consultationDate']);
        $stmt->bindParam(":chiefComplaint",   $json['chiefComplaint']);
        $stmt->bindParam(":symptoms",         $json['symptoms']);
        $stmt->bindParam(":treatment",        $json['treatment']);
        $stmt->bindParam(":notes",            $json['notes']);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $newConsultationId = $conn->lastInsertId();
            // Mark appointment as Completed
            $upd = $conn->prepare("UPDATE APPOINTMENT SET Status = 'Completed' WHERE AppointmentID = :apptId");
            $upd->bindParam(":apptId", $json['appointmentId']);
            $upd->execute();
            // Return the new ID so the doctor can be taken straight to the
            // consultation page to record vital signs (and labs if needed).
            return json_encode(["success" => 1, "consultationId" => (int)$newConsultationId]);
        }
        return json_encode(0);
    }

    // Role name of an ACTIVE user, or null (same approach as billing.php —
    // the app has no server-side sessions, so actingUserId comes from the client).
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

    // SOFT DELETE (Admin only): consultations are referenced by vital signs,
    // diagnoses, labs, prescriptions and billing, so the row is never removed -
    // it is just marked Inactive. Reverse it with restoreConsultation.
    function deactivateConsultation($json) {
        return $this->setConsultationStatus($json, 'Inactive');
    }

    function restoreConsultation($json) {
        return $this->setConsultationStatus($json, 'Active');
    }

    private function setConsultationStatus($json, $status) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if ($this->roleOf($conn, $json['actingUserId'] ?? null) !== 'Admin') {
            return json_encode(["error" => "forbidden"]);
        }
        $sql = "UPDATE CONSULTATION SET Status = :status WHERE ConsultationID = :consultationId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":status", $status);
        $stmt->bindParam(":consultationId", $json['consultationId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Updates an existing consultation
    function updateConsultation($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE CONSULTATION SET
                    ConsultationDate = :consultationDate,
                    ChiefComplaint   = :chiefComplaint,
                    Symptoms         = :symptoms,
                    Treatment        = :treatment,
                    Notes            = :notes
                WHERE ConsultationID = :consultationId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationDate", $json['consultationDate']);
        $stmt->bindParam(":chiefComplaint",   $json['chiefComplaint']);
        $stmt->bindParam(":symptoms",         $json['symptoms']);
        $stmt->bindParam(":treatment",        $json['treatment']);
        $stmt->bindParam(":notes",            $json['notes']);
        $stmt->bindParam(":consultationId",   $json['consultationId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'];
    $json = isset($_GET['json']) ? $_GET['json'] : "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'];
    $json = isset($_POST['json']) ? $_POST['json'] : "";
}

$consultation = new Consultation();
switch ($operation) {
    case "getAppointmentsByDoctor":
        echo $consultation->getAppointmentsByDoctor($json);
        break;
    case "getConsultation":
        echo $consultation->getConsultation($json);
        break;
    case "insertConsultation":
        echo $consultation->insertConsultation($json);
        break;
    case "updateConsultation":
        echo $consultation->updateConsultation($json);
        break;
    case "deactivateConsultation":
        echo $consultation->deactivateConsultation($json);
        break;
    case "restoreConsultation":
        echo $consultation->restoreConsultation($json);
        break;
}
?>
