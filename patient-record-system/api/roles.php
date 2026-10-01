<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Role {

    // Returns ALL roles (Active + Inactive) - used by the admin master file screen
    function getAllRoles() {
        include "connection-pdo.php";
        $sql = "SELECT r.*,
                       (SELECT COUNT(*) FROM USERS u WHERE u.RoleID = r.RoleID) AS UserCount
                FROM ROLE r
                ORDER BY r.RoleName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    // Active roles only - what the Doctor/Staff account forms should
    // use when populating a "Role" dropdown.
    function getActiveRoles() {
        include "connection-pdo.php";
        $sql = "SELECT * FROM ROLE WHERE Status = 'Active' ORDER BY RoleName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    function getRole($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT * FROM ROLE WHERE RoleID = :roleId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":roleId", $json['roleId']);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    function insertRole($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "INSERT INTO ROLE (RoleName, Description, Status)
                VALUES (:roleName, :description, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":roleName", $json['roleName']);
        $stmt->bindParam(":description", $json['description']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    function updateRole($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE ROLE SET RoleName = :roleName, Description = :description
                WHERE RoleID = :roleId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":roleName", $json['roleName']);
        $stmt->bindParam(":description", $json['description']);
        $stmt->bindParam(":roleId", $json['roleId']);
        $stmt->execute();

        $check = $conn->prepare("SELECT RoleID FROM ROLE WHERE RoleID = :roleId");
        $check->bindParam(":roleId", $json['roleId']);
        $check->execute();
        $returnValue = $check->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    // SOFT DELETE: a role is referenced by USERS.RoleID (NOT NULL FK), so it
    // can never be physically removed once any account has been created with
    // it - existing accounts (and their appointment/consultation/billing
    // history) still need a valid RoleID. Deactivating just hides the role
    // from the "assign a role" dropdown for NEW accounts going forward.
    function deleteRole($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE ROLE SET Status = 'Inactive' WHERE RoleID = :roleId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":roleId", $json['roleId']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    // Reverses a soft delete
    function restoreRole($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE ROLE SET Status = 'Active' WHERE RoleID = :roleId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":roleId", $json['roleId']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }
}

// submitted by the client - operation and json
if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'];
    $json = isset($_GET['json']) ? $_GET['json'] : "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'];
    $json = isset($_POST['json']) ? $_POST['json'] : "";
}

$role = new Role();
switch ($operation) {
    case "getAllRoles":
        echo $role->getAllRoles();
        break;
    case "getActiveRoles":
        echo $role->getActiveRoles();
        break;
    case "getRole":
        echo $role->getRole($json);
        break;
    case "insertRole":
        echo $role->insertRole($json);
        break;
    case "updateRole":
        echo $role->updateRole($json);
        break;
    case "deleteRole":
        echo $role->deleteRole($json);
        break;
    case "restoreRole":
        echo $role->restoreRole($json);
        break;
}
?>
