<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Auth {

    function login($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $username = trim($json['username'] ?? "");
        $password = $json['password'] ?? "";

        if ($username === "" || $password === "") {
            return json_encode(["error" => "missing_fields"]);
        }

        $sql = "SELECT u.UserID, u.Username, u.Password, u.FirstName, u.LastName, u.Status,
                       r.RoleID, r.RoleName
                FROM USERS u
                JOIN ROLE r ON u.RoleID = r.RoleID
                WHERE u.Username = :username";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":username", $username);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        // NOTE: passwords are stored/compared as plain text here to match
        // the class's teaching pattern (see api/doctors.php). In a real
        // system you'd use password_hash() / password_verify() instead.
        if (!$user || $user['Password'] !== $password) {
            return json_encode(["error" => "invalid_credentials"]);
        }
        if ($user['Status'] !== 'Active') {
            return json_encode(["error" => "account_inactive"]);
        }

        unset($user['Password']);
        return json_encode(["success" => true, "user" => $user]);
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

$auth = new Auth();
switch ($operation) {
    case "login":
        echo $auth->login($json);
        break;
}
?>
