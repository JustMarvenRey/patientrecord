<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Appointment {

    // All appointments — Admin/Staff view (full list, all doctors)
    function getAllAppointments() {
        include "connection-pdo.php";
        $sql = "SELECT
                    a.AppointmentID,
                    a.AppointmentDate,
                    a.AppointmentTime,
                    a.Reason,
                    a.Status,
                    a.Notes,
                    CONCAT(p.LastName, ', ', p.FirstName) AS PatientName,
                    p.PatientID,
                    CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName,
                    u.UserID
                FROM APPOINTMENT a
                JOIN PATIENT p ON a.PatientID = p.PatientID
                JOIN USERS   u ON a.UserID    = u.UserID
                ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Appointments for a specific doctor (Doctor view)
    function getAppointmentsByDoctor($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT
                    a.AppointmentID,
                    a.AppointmentDate,
                    a.AppointmentTime,
                    a.Reason,
                    a.Status,
                    a.Notes,
                    CONCAT(p.LastName, ', ', p.FirstName) AS PatientName,
                    p.PatientID,
                    CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName,
                    u.UserID
                FROM APPOINTMENT a
                JOIN PATIENT p ON a.PatientID = p.PatientID
                JOIN USERS   u ON a.UserID    = u.UserID
                WHERE a.UserID = :userId
                ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":userId", $json['userId']);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Single appointment detail
    function getAppointment($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT
                    a.*,
                    CONCAT(p.LastName, ', ', p.FirstName) AS PatientName,
                    CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName
                FROM APPOINTMENT a
                JOIN PATIENT p ON a.PatientID = p.PatientID
                JOIN USERS   u ON a.UserID    = u.UserID
                WHERE a.AppointmentID = :appointmentId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":appointmentId", $json['appointmentId']);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Get all active doctors for the doctor dropdown
    function getActiveDoctors() {
        include "connection-pdo.php";
        $sql = "SELECT u.UserID,
                       CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName,
                       GROUP_CONCAT(s.SpecializationName ORDER BY s.SpecializationName SEPARATOR ', ') AS Specializations
                FROM USERS u
                JOIN ROLE r ON u.RoleID = r.RoleID
                LEFT JOIN DOCTOR_SPECIALIZATION ds ON ds.UserID = u.UserID
                LEFT JOIN SPECIALIZATION s ON s.SpecializationID = ds.SpecializationID
                WHERE r.RoleName = 'Doctor' AND u.Status = 'Active'
                GROUP BY u.UserID, u.LastName, u.FirstName
                ORDER BY u.LastName, u.FirstName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // True when $date (YYYY-MM-DD) is a real date and is today or later.
    private function isTodayOrFuture($date) {
        $d = DateTime::createFromFormat('Y-m-d', $date ?? '');
        if (!$d || $d->format('Y-m-d') !== $date) return false;
        return $date >= date('Y-m-d');
    }

    // Create — available to Staff, Doctor, and Patient (all roles)
    function insertAppointment($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);

        if (empty($json['patientId']) || empty($json['userId']) ||
            empty($json['appointmentDate']) || empty($json['appointmentTime'])) {
            return json_encode(["error" => "missing_required_fields"]);
        }

        if (!$this->isTodayOrFuture($json['appointmentDate'])) {
            return json_encode(["error" => "date_in_past"]);
        }

        $sql = "INSERT INTO APPOINTMENT
                    (PatientID, UserID, AppointmentDate, AppointmentTime, Reason, Notes, Status)
                VALUES
                    (:patientId, :userId, :appointmentDate, :appointmentTime, :reason, :notes, 'Scheduled')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":patientId",       $json['patientId']);
        $stmt->bindParam(":userId",          $json['userId']);
        $stmt->bindParam(":appointmentDate", $json['appointmentDate']);
        $stmt->bindParam(":appointmentTime", $json['appointmentTime']);
        $stmt->bindParam(":reason",          $json['reason']);
        $stmt->bindParam(":notes",           $json['notes']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Update — Admin and Staff only
    function updateAppointment($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);

        $cur = $conn->prepare("SELECT AppointmentDate FROM APPOINTMENT WHERE AppointmentID = :id");
        $cur->bindParam(":id", $json['appointmentId']);
        $cur->execute();
        $currentDate = $cur->fetchColumn();
        if ($json['appointmentDate'] !== $currentDate && !$this->isTodayOrFuture($json['appointmentDate'])) {
            return json_encode(["error" => "date_in_past"]);
        }

        $sql = "UPDATE APPOINTMENT SET
                    PatientID       = :patientId,
                    UserID          = :userId,
                    AppointmentDate = :appointmentDate,
                    AppointmentTime = :appointmentTime,
                    Reason          = :reason,
                    Notes           = :notes,
                    Status          = :status
                WHERE AppointmentID = :appointmentId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":patientId",       $json['patientId']);
        $stmt->bindParam(":userId",          $json['userId']);
        $stmt->bindParam(":appointmentDate", $json['appointmentDate']);
        $stmt->bindParam(":appointmentTime", $json['appointmentTime']);
        $stmt->bindParam(":reason",          $json['reason']);
        $stmt->bindParam(":notes",           $json['notes']);
        $stmt->bindParam(":status",          $json['status']);
        $stmt->bindParam(":appointmentId",   $json['appointmentId']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Cancel — Admin and Staff only (soft status change)
    function cancelAppointment($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE APPOINTMENT SET Status = 'Cancelled' WHERE AppointmentID = :appointmentId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":appointmentId", $json['appointmentId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Restore a cancelled appointment back to Scheduled (Admin "Restore" button).
    // Only touches rows that are currently Cancelled.
    function restoreAppointment($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE APPOINTMENT SET Status = 'Scheduled'
                WHERE AppointmentID = :appointmentId AND Status = 'Cancelled'";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":appointmentId", $json['appointmentId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'];
    $json = isset($_GET['json']) ? $_GET['json'] : "";
} else {
    $operation = $_POST['operation'];
    $json = isset($_POST['json']) ? $_POST['json'] : "";
}

$appt = new Appointment();
switch ($operation) {
    case "getAllAppointments":       echo $appt->getAllAppointments();           break;
    case "getAppointmentsByDoctor": echo $appt->getAppointmentsByDoctor($json); break;
    case "getAppointment":          echo $appt->getAppointment($json);          break;
    case "getActiveDoctors":        echo $appt->getActiveDoctors();             break;
    case "insertAppointment":       echo $appt->insertAppointment($json);       break;
    case "updateAppointment":       echo $appt->updateAppointment($json);       break;
    case "cancelAppointment":       echo $appt->cancelAppointment($json);       break;
    case "restoreAppointment":      echo $appt->restoreAppointment($json);      break;
}
?>
