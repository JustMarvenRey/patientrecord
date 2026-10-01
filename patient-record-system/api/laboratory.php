<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Laboratory {

    // Get all laboratory records for a consultation
    function getLaboratoriesByConsultation($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT l.LaboratoryID, l.ConsultationID, l.TestID, l.TestDate,
                       l.Result, l.ReferenceRange, l.Status,
                       lt.TestName, lt.NormalRange, lt.Description AS TestDescription
                FROM LABORATORY l
                JOIN LABORATORY_TEST lt ON l.TestID = lt.TestID
                WHERE l.ConsultationID = :consultationId AND l.Status = 'Active'
                ORDER BY l.TestDate DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId", $json['consultationId']);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Get a single laboratory record
    function getLaboratory($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT l.LaboratoryID, l.ConsultationID, l.TestID, l.TestDate,
                       l.Result, l.ReferenceRange, l.Status,
                       lt.TestName, lt.NormalRange, lt.Description AS TestDescription
                FROM LABORATORY l
                JOIN LABORATORY_TEST lt ON l.TestID = lt.TestID
                WHERE l.LaboratoryID = :laboratoryId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":laboratoryId", $json['laboratoryId']);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Insert a new laboratory record
    function insertLaboratory($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "INSERT INTO LABORATORY
                    (ConsultationID, TestID, TestDate, Result, ReferenceRange, Status)
                VALUES
                    (:consultationId, :testId, :testDate, :result, :referenceRange, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId", $json['consultationId']);
        $stmt->bindParam(":testId",         $json['testId']);
        $stmt->bindParam(":testDate",       $json['testDate']);
        $stmt->bindValue(":result",         $json['result']         ?? null);
        $stmt->bindValue(":referenceRange", $json['referenceRange'] ?? null);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Update an existing laboratory record
    function updateLaboratory($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE LABORATORY SET
                    TestID         = :testId,
                    TestDate       = :testDate,
                    Result         = :result,
                    ReferenceRange = :referenceRange
                WHERE LaboratoryID = :laboratoryId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":testId",         $json['testId']);
        $stmt->bindParam(":testDate",       $json['testDate']);
        $stmt->bindValue(":result",         $json['result']         ?? null);
        $stmt->bindValue(":referenceRange", $json['referenceRange'] ?? null);
        $stmt->bindParam(":laboratoryId",   $json['laboratoryId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Soft delete a laboratory record
    function removeLaboratory($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE LABORATORY SET Status = 'Inactive' WHERE LaboratoryID = :laboratoryId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":laboratoryId", $json['laboratoryId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Get all active tests for the dropdown
    function getActiveTests() {
        include "connection-pdo.php";
        $sql = "SELECT TestID, TestName, NormalRange, Description
                FROM LABORATORY_TEST
                WHERE Status = 'Active'
                ORDER BY TestName";
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

$lab = new Laboratory();
switch ($operation) {
    case "getLaboratoriesByConsultation": echo $lab->getLaboratoriesByConsultation($json); break;
    case "getLaboratory":                 echo $lab->getLaboratory($json);                 break;
    case "insertLaboratory":              echo $lab->insertLaboratory($json);              break;
    case "updateLaboratory":              echo $lab->updateLaboratory($json);              break;
    case "removeLaboratory":              echo $lab->removeLaboratory($json);              break;
    case "getActiveTests":                echo $lab->getActiveTests();                     break;
}
?>
