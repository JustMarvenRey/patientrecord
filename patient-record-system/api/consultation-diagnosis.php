<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class ConsultationDiagnosis {

    // Returns all active diagnoses linked to a consultation,
    // joined with the ICD-10 code and name for display.
    function getDiagnosesByConsultation($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT cd.ConsultationDiagnosisID, cd.ConsultationID, cd.DiagnosisID, cd.Status,
                       d.ICD10Code, d.DiagnosisName, d.Description
                FROM CONSULTATION_DIAGNOSIS cd
                INNER JOIN DIAGNOSIS_ICD10 d ON d.DiagnosisID = cd.DiagnosisID
                WHERE cd.ConsultationID = :consultationId
                  AND cd.Status = 'Active'
                ORDER BY d.DiagnosisName";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId", $json['consultationId']);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    // Links a diagnosis to a consultation.
    // Guard: the same diagnosis cannot be added twice to the same consultation.
    function addDiagnosis($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);

        // Check for existing active link
        $chk = $conn->prepare(
            "SELECT ConsultationDiagnosisID FROM CONSULTATION_DIAGNOSIS
             WHERE ConsultationID = :consultationId
               AND DiagnosisID   = :diagnosisId
               AND Status        = 'Active'"
        );
        $chk->bindParam(":consultationId", $json['consultationId']);
        $chk->bindParam(":diagnosisId",    $json['diagnosisId']);
        $chk->execute();
        if ($chk->rowCount() > 0) {
            return json_encode(["error" => "already_linked"]);
        }

        // If it was previously soft-deleted, restore it instead of inserting duplicate
        $restore = $conn->prepare(
            "SELECT ConsultationDiagnosisID FROM CONSULTATION_DIAGNOSIS
             WHERE ConsultationID = :consultationId
               AND DiagnosisID   = :diagnosisId
               AND Status        = 'Inactive'"
        );
        $restore->bindParam(":consultationId", $json['consultationId']);
        $restore->bindParam(":diagnosisId",    $json['diagnosisId']);
        $restore->execute();
        if ($restore->rowCount() > 0) {
            $upd = $conn->prepare(
                "UPDATE CONSULTATION_DIAGNOSIS SET Status = 'Active'
                 WHERE ConsultationID = :consultationId AND DiagnosisID = :diagnosisId"
            );
            $upd->bindParam(":consultationId", $json['consultationId']);
            $upd->bindParam(":diagnosisId",    $json['diagnosisId']);
            $upd->execute();
            return json_encode($upd->rowCount() > 0 ? 1 : 0);
        }

        $sql = "INSERT INTO CONSULTATION_DIAGNOSIS (ConsultationID, DiagnosisID, Status)
                VALUES (:consultationId, :diagnosisId, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId", $json['consultationId']);
        $stmt->bindParam(":diagnosisId",    $json['diagnosisId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Soft delete — removes a diagnosis from this consultation's record.
    // Uses Status = 'Inactive' so the historical link is preserved if needed.
    function removeDiagnosis($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE CONSULTATION_DIAGNOSIS SET Status = 'Inactive'
                WHERE ConsultationDiagnosisID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['consultationDiagnosisId']);
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

$cd = new ConsultationDiagnosis();
switch ($operation) {
    case "getDiagnosesByConsultation":
        echo $cd->getDiagnosesByConsultation($json);
        break;
    case "addDiagnosis":
        echo $cd->addDiagnosis($json);
        break;
    case "removeDiagnosis":
        echo $cd->removeDiagnosis($json);
        break;
}
?>
