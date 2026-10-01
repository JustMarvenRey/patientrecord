<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

// Doctors master file.
// There is no DOCTOR table any more: a doctor is a USERS row whose role is
// 'Doctor' (phone is USERS.Phone), and specializations hang off the user via
// DOCTOR_SPECIALIZATION(UserID, SpecializationID). A doctor's ID is therefore
// simply their UserID. New doctors are created from the User Accounts page
// (api/users.php) by choosing the Doctor role.
class Doctor {

    // Phone is optional, but if the admin does type one in it must be
    // 7-15 digits only - no "-", "+", letters, spaces, etc. This is what
    // blocks a negative number (or any other garbage) from being saved.
    private function isValidPhone($phone) {
        $phone = trim($phone ?? "");
        return $phone === "" || preg_match('/^[0-9]{7,15}$/', $phone) === 1;
    }

    private function isValidUsername($username) {
        return preg_match('/^[A-Za-z0-9_]{3,50}$/', $username) === 1;
    }

    // True when this UserID belongs to a user whose role is 'Doctor'.
    private function isDoctor($conn, $userId) {
        $stmt = $conn->prepare("SELECT u.UserID FROM USERS u
                                INNER JOIN ROLE r ON r.RoleID = u.RoleID
                                WHERE u.UserID = :userId AND r.RoleName = 'Doctor'");
        $stmt->bindParam(":userId", $userId);
        $stmt->execute();
        return (bool) $stmt->fetch();
    }

    // Shared SELECT: every Doctor-role user + their specializations in one column
    // (GROUP_CONCAT over the DOCTOR_SPECIALIZATION junction).
    private function doctorListSql($onlyActive) {
        return "SELECT u.UserID, u.Phone, u.Username, u.FirstName, u.LastName, u.Status,
                       GROUP_CONCAT(s.SpecializationName ORDER BY s.SpecializationName SEPARATOR ', ') AS Specializations
                FROM USERS u
                INNER JOIN ROLE r ON r.RoleID = u.RoleID
                LEFT JOIN DOCTOR_SPECIALIZATION ds ON ds.UserID = u.UserID
                LEFT JOIN SPECIALIZATION s ON s.SpecializationID = ds.SpecializationID
                WHERE r.RoleName = 'Doctor'" . ($onlyActive ? " AND u.Status = 'Active'" : "") . "
                GROUP BY u.UserID, u.Phone, u.Username, u.FirstName, u.LastName, u.Status
                ORDER BY u.LastName, u.FirstName";
    }

    // Returns ALL doctors (Active + Inactive) - used by the admin master file screen.
    function getAllDoctors() {
        include "connection-pdo.php";
        $stmt = $conn->prepare($this->doctorListSql(false));
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Active-only doctors - what transaction modules (Appointments, Consultations)
    // should call when they need to let a user pick a doctor.
    function getActiveDoctors() {
        include "connection-pdo.php";
        $stmt = $conn->prepare($this->doctorListSql(true));
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Single doctor + the list of specializations they currently have
    // (used to re-populate the checkboxes when editing).
    function getDoctor($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);

        $sql = "SELECT u.UserID, u.Phone, u.Username, u.FirstName, u.LastName, u.Status
                FROM USERS u
                INNER JOIN ROLE r ON r.RoleID = u.RoleID
                WHERE u.UserID = :userId AND r.RoleName = 'Doctor'";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":userId", $json['userId']);
        $stmt->execute();
        $doctor = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($doctor) > 0) {
            $sql2 = "SELECT s.SpecializationID, s.SpecializationName
                     FROM DOCTOR_SPECIALIZATION ds
                     INNER JOIN SPECIALIZATION s ON s.SpecializationID = ds.SpecializationID
                     WHERE ds.UserID = :userId
                     ORDER BY s.SpecializationName";
            $stmt2 = $conn->prepare($sql2);
            $stmt2->bindParam(":userId", $json['userId']);
            $stmt2->execute();
            $doctor[0]['specializations'] = $stmt2->fetchAll(PDO::FETCH_ASSOC);
        }

        return json_encode($doctor);
    }

    // Updates the USERS row (password only if a new one was provided, Phone included),
    // then replaces the doctor's specialization set. One transaction so a failure
    // can't leave the doctor half-updated.
    function updateDoctor($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $userId = $json['userId'] ?? "";
        $username = trim($json['username'] ?? "");
        $firstName = trim($json['firstName'] ?? "");
        $lastName = trim($json['lastName'] ?? "");
        $password = $json['password'] ?? "";
        $phone = trim($json['phone'] ?? "");
        $specializationIds = (isset($json['specializationIds']) && is_array($json['specializationIds']))
            ? $json['specializationIds'] : [];

        if ($firstName === "" || $lastName === "" || $username === "") {
            return json_encode(["error" => "missing_fields"]);
        }
        if (!$this->isValidUsername($username)) return json_encode(["error" => "invalid_username"]);
        if ($password !== "" && strlen($password) < 6) return json_encode(["error" => "weak_password"]);
        if (!$this->isValidPhone($phone)) return json_encode(["error" => "invalid_phone"]);
        if (!$this->isDoctor($conn, $userId)) return json_encode(["error" => "not_found"]);

        $dup = $conn->prepare("SELECT UserID FROM USERS WHERE Username = :username AND UserID != :userId");
        $dup->bindParam(":username", $username);
        $dup->bindParam(":userId", $userId);
        $dup->execute();
        if ($dup->fetch()) return json_encode(["error" => "username_taken"]);

        $phoneValue = $phone === "" ? null : $phone;

        try {
            $conn->beginTransaction();

            if ($password !== "") {
                $sql = "UPDATE USERS SET Username = :username, Password = :password,
                            FirstName = :firstName, LastName = :lastName, Phone = :phone
                        WHERE UserID = :userId";
            } else {
                $sql = "UPDATE USERS SET Username = :username,
                            FirstName = :firstName, LastName = :lastName, Phone = :phone
                        WHERE UserID = :userId";
            }
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":username", $username);
            if ($password !== "") $stmt->bindParam(":password", $password);
            $stmt->bindParam(":firstName", $firstName);
            $stmt->bindParam(":lastName", $lastName);
            $stmt->bindParam(":phone", $phoneValue);
            $stmt->bindParam(":userId", $userId);
            $stmt->execute();

            $del = $conn->prepare("DELETE FROM DOCTOR_SPECIALIZATION WHERE UserID = :userId");
            $del->bindParam(":userId", $userId);
            $del->execute();

            $this->saveSpecializations($conn, $userId, $specializationIds);

            $conn->commit();
            return json_encode(1);
        } catch (Exception $e) {
            if ($conn->inTransaction()) $conn->rollBack();
            return json_encode(0);
        }
    }

    // Shared helper: inserts one DOCTOR_SPECIALIZATION row per selected specialization.
    private function saveSpecializations($conn, $userId, $specializationIds) {
        $stmt = $conn->prepare("INSERT INTO DOCTOR_SPECIALIZATION (UserID, SpecializationID) VALUES (:userId, :specId)");
        foreach (array_unique($specializationIds) as $specId) {
            $stmt->bindValue(":userId", $userId);
            $stmt->bindValue(":specId", $specId);
            $stmt->execute();
        }
    }

    // SOFT DELETE: doctors are referenced by APPOINTMENT and (through
    // CONSULTATION) PROFESSIONAL_FEE, so we never physically remove
    // the account. We flip the USERS row to Inactive so the doctor drops
    // out of transaction pickers but historical records that point to
    // this UserID stay valid.
    private function setStatus($json, $status) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE USERS u
                INNER JOIN ROLE r ON r.RoleID = u.RoleID
                SET u.Status = :status
                WHERE u.UserID = :userId AND r.RoleName = 'Doctor'";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":status", $status);
        $stmt->bindParam(":userId", $json['userId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    function deleteDoctor($json)  { return $this->setStatus($json, 'Inactive'); }

    // Reverses a soft delete
    function restoreDoctor($json) { return $this->setStatus($json, 'Active'); }
}

// submitted by the client - operation and json
if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'];
    $json = isset($_GET['json']) ? $_GET['json'] : "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'];
    $json = isset($_POST['json']) ? $_POST['json'] : "";
}

$doctor = new Doctor();
switch ($operation) {
    case "getAllDoctors":
        echo $doctor->getAllDoctors();
        break;
    case "getActiveDoctors":
        echo $doctor->getActiveDoctors();
        break;
    case "getDoctor":
        echo $doctor->getDoctor($json);
        break;
    case "updateDoctor":
        echo $doctor->updateDoctor($json);
        break;
    case "deleteDoctor":
        echo $doctor->deleteDoctor($json);
        break;
    case "restoreDoctor":
        echo $doctor->restoreDoctor($json);
        break;
}
?>
