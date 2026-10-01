<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Generic {

    // Returns ALL generics (Active + Inactive) - used by the admin master file screen
    function getAllGenerics() {
        include "connection-pdo.php";
        $sql = "SELECT g.*,
                       (SELECT COUNT(*) FROM MEDICINE m WHERE m.GenericID = g.GenericID) AS MedicineCount
                FROM GENERIC g
                ORDER BY g.GenericName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    // Active generics only - what the Medicine master file form uses
    // to populate its "Generic Name" dropdown.
    function getActiveGenerics() {
        include "connection-pdo.php";
        $sql = "SELECT * FROM GENERIC WHERE Status = 'Active' ORDER BY GenericName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    function getGeneric($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT * FROM GENERIC WHERE GenericID = :genericId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":genericId", $json['genericId']);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    function insertGeneric($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "INSERT INTO GENERIC (GenericName, Description, Status)
                VALUES (:genericName, :description, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":genericName", $json['genericName']);
        $stmt->bindParam(":description", $json['description']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    function updateGeneric($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE GENERIC SET GenericName = :genericName, Description = :description
                WHERE GenericID = :genericId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":genericName", $json['genericName']);
        $stmt->bindParam(":description", $json['description']);
        $stmt->bindParam(":genericId", $json['genericId']);
        $stmt->execute();

        $check = $conn->prepare("SELECT GenericID FROM GENERIC WHERE GenericID = :genericId");
        $check->bindParam(":genericId", $json['genericId']);
        $check->execute();
        $returnValue = $check->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    // SOFT DELETE: a generic is referenced by MEDICINE.GenericID, and
    // medicines are in turn referenced by PRESCRIPTION history, so it is
    // never physically removed. Deactivating hides it from the "Generic
    // Name" picker on the Medicine form going forward, while medicines
    // (and prescriptions) already linked to it stay valid.
    function deleteGeneric($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE GENERIC SET Status = 'Inactive' WHERE GenericID = :genericId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":genericId", $json['genericId']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    function restoreGeneric($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE GENERIC SET Status = 'Active' WHERE GenericID = :genericId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":genericId", $json['genericId']);
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

$generic = new Generic();
switch ($operation) {
    case "getAllGenerics":
        echo $generic->getAllGenerics();
        break;
    case "getActiveGenerics":
        echo $generic->getActiveGenerics();
        break;
    case "getGeneric":
        echo $generic->getGeneric($json);
        break;
    case "insertGeneric":
        echo $generic->insertGeneric($json);
        break;
    case "updateGeneric":
        echo $generic->updateGeneric($json);
        break;
    case "deleteGeneric":
        echo $generic->deleteGeneric($json);
        break;
    case "restoreGeneric":
        echo $generic->restoreGeneric($json);
        break;
}
?>
