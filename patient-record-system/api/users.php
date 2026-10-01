<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

// User account management (Admin only).
// Manages every account type, Doctor included. There is no separate DOCTOR table:
// a Doctor is just a USERS row with the 'Doctor' role. Phone is a USERS column, and
// a doctor's specializations are DOCTOR_SPECIALIZATION(UserID, SpecializationID) rows.
class User {

    private function isValidUsername($username) {
        return preg_match('/^[A-Za-z0-9_]{3,50}$/', $username) === 1;
    }

    // Every operation checks that the caller is an active Admin.
    // NOTE: this app has no server-side sessions, so actingUserId comes from
    // the client. It stops the UI/API being used casually by non-admins, but
    // it is not real authentication - a proper fix is PHP sessions or tokens.
    private function isAdmin($conn, $actingUserId) {
        if (empty($actingUserId)) return false;
        $stmt = $conn->prepare("SELECT u.UserID FROM USERS u
                                JOIN ROLE r ON u.RoleID = r.RoleID
                                WHERE u.UserID = :id AND r.RoleName = 'Admin' AND u.Status = 'Active'");
        $stmt->bindParam(":id", $actingUserId);
        $stmt->execute();
        return (bool) $stmt->fetch();
    }

    // Returns the role's name, or null if the role doesn't exist / isn't Active.
    private function activeRoleName($conn, $roleId) {
        $stmt = $conn->prepare("SELECT RoleName FROM ROLE WHERE RoleID = :roleId AND Status = 'Active'");
        $stmt->bindParam(":roleId", $roleId);
        $stmt->execute();
        $role = $stmt->fetch(PDO::FETCH_ASSOC);
        return $role ? $role['RoleName'] : null;
    }

    // Phone is optional, but if given it must be 7-15 digits only.
    private function isValidPhone($phone) {
        $phone = trim($phone ?? "");
        return $phone === "" || preg_match('/^[0-9]{7,15}$/', $phone) === 1;
    }

    // Replaces a user's specialization set (only meaningful for Doctor-role users).
    // Pass an empty array to clear them.
    private function saveSpecializations($conn, $userId, $specializationIds) {
        $del = $conn->prepare("DELETE FROM DOCTOR_SPECIALIZATION WHERE UserID = :userId");
        $del->bindParam(":userId", $userId);
        $del->execute();

        $stmt = $conn->prepare("INSERT INTO DOCTOR_SPECIALIZATION (UserID, SpecializationID) VALUES (:userId, :specId)");
        foreach (array_unique($specializationIds) as $specId) {
            $stmt->bindValue(":userId", $userId);
            $stmt->bindValue(":specId", $specId);
            $stmt->execute();
        }
    }

    // All accounts (Active + Inactive, every role) for the admin table
    function getAllUsers($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->isAdmin($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $sql = "SELECT u.UserID, u.Username, u.FirstName, u.LastName, u.Phone, u.Status, r.RoleID, r.RoleName,
                       GROUP_CONCAT(s.SpecializationName ORDER BY s.SpecializationName SEPARATOR ', ') AS Specializations
                FROM USERS u
                JOIN ROLE r ON u.RoleID = r.RoleID
                LEFT JOIN DOCTOR_SPECIALIZATION ds ON ds.UserID = u.UserID
                LEFT JOIN SPECIALIZATION s ON s.SpecializationID = ds.SpecializationID
                GROUP BY u.UserID, u.Username, u.FirstName, u.LastName, u.Phone, u.Status, r.RoleID, r.RoleName
                ORDER BY u.LastName, u.FirstName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Active roles an admin can assign here
    function getAssignableRoles($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->isAdmin($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $stmt = $conn->prepare("SELECT RoleID, RoleName FROM ROLE WHERE Status = 'Active' ORDER BY RoleName");
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getUser($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->isAdmin($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $sql = "SELECT u.UserID, u.Username, u.FirstName, u.LastName, u.Phone, u.Status, r.RoleID, r.RoleName
                FROM USERS u JOIN ROLE r ON u.RoleID = r.RoleID
                WHERE u.UserID = :userId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":userId", $json['userId']);
        $stmt->execute();
        $user = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($user) > 0) {
            $stmt2 = $conn->prepare("SELECT s.SpecializationID, s.SpecializationName
                                     FROM DOCTOR_SPECIALIZATION ds
                                     JOIN SPECIALIZATION s ON s.SpecializationID = ds.SpecializationID
                                     WHERE ds.UserID = :userId
                                     ORDER BY s.SpecializationName");
            $stmt2->bindParam(":userId", $json['userId']);
            $stmt2->execute();
            $user[0]['specializations'] = $stmt2->fetchAll(PDO::FETCH_ASSOC);
        }
        return json_encode($user);
    }

    function insertUser($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        if (!$this->isAdmin($conn, $json['actingUserId'] ?? null)) return json_encode(["error" => "forbidden"]);

        $firstName = trim($json['firstName'] ?? "");
        $lastName  = trim($json['lastName'] ?? "");
        $username  = trim($json['username'] ?? "");
        $password  = $json['password'] ?? "";
        $roleId    = $json['roleId'] ?? "";

        if ($firstName === "" || $lastName === "" || $username === "" || $password === "" || $roleId === "") {
            return json_encode(["error" => "missing_fields"]);
        }
        if (!$this->isValidUsername($username)) return json_encode(["error" => "invalid_username"]);
        if (strlen($password) < 6) return json_encode(["error" => "weak_password"]);
        $roleName = $this->activeRoleName($conn, $roleId);
        if ($roleName === null) return json_encode(["error" => "invalid_role"]);

        // Phone is a USERS column, so it is accepted for every role.
        $phone = trim($json['phone'] ?? "");
        if (!$this->isValidPhone($phone)) return json_encode(["error" => "invalid_phone"]);
        $phoneValue = $phone === "" ? null : $phone;
        $specializationIds = (isset($json['specializationIds']) && is_array($json['specializationIds']))
            ? $json['specializationIds'] : [];

        $dup = $conn->prepare("SELECT UserID FROM USERS WHERE Username = :username");
        $dup->bindParam(":username", $username);
        $dup->execute();
        if ($dup->fetch()) return json_encode(["error" => "username_taken"]);

        $sql = "INSERT INTO USERS (RoleID, Username, Password, FirstName, LastName, Phone, Status)
                VALUES (:roleId, :username, :password, :firstName, :lastName, :phone, 'Active')";
        try {
            $conn->beginTransaction();
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":roleId", $roleId);
            $stmt->bindParam(":username", $username);
            $stmt->bindParam(":password", $password);
            $stmt->bindParam(":firstName", $firstName);
            $stmt->bindParam(":lastName", $lastName);
            $stmt->bindParam(":phone", $phoneValue);
            $stmt->execute();
            $newUserId = $conn->lastInsertId();

            if ($roleName === 'Doctor') {
                $this->saveSpecializations($conn, $newUserId, $specializationIds);
            }
            $conn->commit();
            return json_encode(1);
        } catch (Exception $e) {
            if ($conn->inTransaction()) $conn->rollBack();
            return json_encode(0);
        }
    }

    // Password is only changed if a new one is sent. An admin can't change their
    // own role. Phone is saved for every role; specializations only apply to the
    // Doctor role (they are cleared if the account is moved to another role).
    function updateUser($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $actingUserId = $json['actingUserId'] ?? null;
        if (!$this->isAdmin($conn, $actingUserId)) return json_encode(["error" => "forbidden"]);

        $userId    = $json['userId'] ?? "";
        $firstName = trim($json['firstName'] ?? "");
        $lastName  = trim($json['lastName'] ?? "");
        $username  = trim($json['username'] ?? "");
        $password  = $json['password'] ?? "";
        $roleId    = $json['roleId'] ?? "";
        $phone     = trim($json['phone'] ?? "");

        if ($firstName === "" || $lastName === "" || $username === "" || $roleId === "") {
            return json_encode(["error" => "missing_fields"]);
        }
        if (!$this->isValidUsername($username)) return json_encode(["error" => "invalid_username"]);
        if ($password !== "" && strlen($password) < 6) return json_encode(["error" => "weak_password"]);
        if (!$this->isValidPhone($phone)) return json_encode(["error" => "invalid_phone"]);
        $phoneValue = $phone === "" ? null : $phone;
        $roleName = $this->activeRoleName($conn, $roleId);
        if ($roleName === null) return json_encode(["error" => "invalid_role"]);

        $cur = $conn->prepare("SELECT u.RoleID, r.RoleName FROM USERS u JOIN ROLE r ON u.RoleID = r.RoleID WHERE u.UserID = :id");
        $cur->bindParam(":id", $userId);
        $cur->execute();
        $current = $cur->fetch(PDO::FETCH_ASSOC);
        if (!$current) return json_encode(["error" => "not_found"]);
        if ((int)$userId === (int)$actingUserId && (int)$roleId !== (int)$current['RoleID']) {
            return json_encode(["error" => "cannot_change_own_role"]);
        }

        $dup = $conn->prepare("SELECT UserID FROM USERS WHERE Username = :username AND UserID != :id");
        $dup->bindParam(":username", $username);
        $dup->bindParam(":id", $userId);
        $dup->execute();
        if ($dup->fetch()) return json_encode(["error" => "username_taken"]);

        if ($password !== "") {
            $sql = "UPDATE USERS SET RoleID = :roleId, Username = :username, Password = :password,
                           FirstName = :firstName, LastName = :lastName, Phone = :phone WHERE UserID = :userId";
        } else {
            $sql = "UPDATE USERS SET RoleID = :roleId, Username = :username,
                           FirstName = :firstName, LastName = :lastName, Phone = :phone WHERE UserID = :userId";
        }

        try {
            $conn->beginTransaction();
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":roleId", $roleId);
            $stmt->bindParam(":username", $username);
            if ($password !== "") $stmt->bindParam(":password", $password);
            $stmt->bindParam(":firstName", $firstName);
            $stmt->bindParam(":lastName", $lastName);
            $stmt->bindParam(":phone", $phoneValue);
            $stmt->bindParam(":userId", $userId);
            $stmt->execute();

            if ($roleName !== 'Doctor') {
                // Not a doctor (any more): specializations make no sense, clear them.
                $this->saveSpecializations($conn, $userId, []);
            } else if (isset($json['specializationIds']) && is_array($json['specializationIds'])) {
                // Only touched when the client actually sent the list.
                $this->saveSpecializations($conn, $userId, $json['specializationIds']);
            }
            $conn->commit();
            return json_encode(1);
        } catch (Exception $e) {
            if ($conn->inTransaction()) $conn->rollBack();
            return json_encode(0);
        }
    }

    // SOFT DELETE - same reasoning as Doctors: USERS rows are referenced by
    // appointments/consultations/billing history, so they are deactivated, not removed.
    private function setStatus($json, $status) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $actingUserId = $json['actingUserId'] ?? null;
        if (!$this->isAdmin($conn, $actingUserId)) return json_encode(["error" => "forbidden"]);

        $userId = $json['userId'] ?? "";
        if ($status === 'Inactive' && (int)$userId === (int)$actingUserId) {
            return json_encode(["error" => "cannot_deactivate_self"]);
        }

        $stmt = $conn->prepare("UPDATE USERS SET Status = :status WHERE UserID = :userId");
        $stmt->bindParam(":status", $status);
        $stmt->bindParam(":userId", $userId);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    function deleteUser($json)  { return $this->setStatus($json, 'Inactive'); }
    function restoreUser($json) { return $this->setStatus($json, 'Active'); }
}

// submitted by the client - operation and json
if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'];
    $json = isset($_GET['json']) ? $_GET['json'] : "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'];
    $json = isset($_POST['json']) ? $_POST['json'] : "";
}

$user = new User();
switch ($operation) {
    case "getAllUsers":
        echo $user->getAllUsers($json);
        break;
    case "getAssignableRoles":
        echo $user->getAssignableRoles($json);
        break;
    case "getUser":
        echo $user->getUser($json);
        break;
    case "insertUser":
        echo $user->insertUser($json);
        break;
    case "updateUser":
        echo $user->updateUser($json);
        break;
    case "deleteUser":
        echo $user->deleteUser($json);
        break;
    case "restoreUser":
        echo $user->restoreUser($json);
        break;
}
?>
