<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class LaboratoryTest {

    function getAllTests() {
        include "connection-pdo.php";
        $sql = "SELECT * FROM LABORATORY_TEST ORDER BY TestName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    // Active tests only - what the Laboratory transaction module should
    // call to let a user pick a test to order/record.
    function getActiveTests() {
        include "connection-pdo.php";
        $sql = "SELECT * FROM LABORATORY_TEST WHERE Status = 'Active' ORDER BY TestName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    function getTest($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT * FROM LABORATORY_TEST WHERE TestID = :testId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":testId", $json['testId']);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    function insertTest($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "INSERT INTO LABORATORY_TEST (TestName, Description, NormalRange, Status)
                VALUES (:testName, :description, :normalRange, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":testName", $json['testName']);
        $stmt->bindParam(":description", $json['description']);
        $stmt->bindParam(":normalRange", $json['normalRange']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    function updateTest($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE LABORATORY_TEST SET
                    TestName = :testName,
                    Description = :description,
                    NormalRange = :normalRange
                WHERE TestID = :testId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":testName", $json['testName']);
        $stmt->bindParam(":description", $json['description']);
        $stmt->bindParam(":normalRange", $json['normalRange']);
        $stmt->bindParam(":testId", $json['testId']);
        $stmt->execute();

        $check = $conn->prepare("SELECT TestID FROM LABORATORY_TEST WHERE TestID = :testId");
        $check->bindParam(":testId", $json['testId']);
        $check->execute();
        $returnValue = $check->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    // SOFT DELETE: a test catalog entry is referenced by LABORATORY.TestID
    // (actual test results tied to real consultations), so it is never
    // physically removed. Deactivating hides it from the "order a test"
    // picker going forward, while past lab results stay valid.
    function deleteTest($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE LABORATORY_TEST SET Status = 'Inactive' WHERE TestID = :testId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":testId", $json['testId']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    function restoreTest($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE LABORATORY_TEST SET Status = 'Active' WHERE TestID = :testId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":testId", $json['testId']);
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

$test = new LaboratoryTest();
switch ($operation) {
    case "getAllTests":
        echo $test->getAllTests();
        break;
    case "getActiveTests":
        echo $test->getActiveTests();
        break;
    case "getTest":
        echo $test->getTest($json);
        break;
    case "insertTest":
        echo $test->insertTest($json);
        break;
    case "updateTest":
        echo $test->updateTest($json);
        break;
    case "deleteTest":
        echo $test->deleteTest($json);
        break;
    case "restoreTest":
        echo $test->restoreTest($json);
        break;
}
?>
