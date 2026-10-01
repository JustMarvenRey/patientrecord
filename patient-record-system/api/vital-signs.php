<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class VitalSign {

    // Returns the vital sign record for a specific consultation.
    // Returns an empty array if no vital signs have been recorded yet.
    function getVitalSign($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT * FROM VITAL_SIGN
                WHERE ConsultationID = :consultationId
                AND Status = 'Active'";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId", $json['consultationId']);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    // Creates a new vital sign record for a consultation.
    // Guard: a consultation can only have ONE vital sign record.
    function insertVitalSign($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);

        // Guard: block duplicate vital sign records
        $chk = $conn->prepare(
            "SELECT VitalSignID FROM VITAL_SIGN
             WHERE ConsultationID = :consultationId AND Status = 'Active'"
        );
        $chk->bindParam(":consultationId", $json['consultationId']);
        $chk->execute();
        if ($chk->rowCount() > 0) {
            return json_encode(["error" => "already_has_vital_sign"]);
        }

        $sql = "INSERT INTO VITAL_SIGN
                    (ConsultationID, Temperature, BloodPressure, HeartRate,
                     RespiratoryRate, OxygenSaturation, Weight, Height, Status)
                VALUES
                    (:consultationId, :temperature, :bloodPressure, :heartRate,
                     :respiratoryRate, :oxygenSaturation, :weight, :height, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId",   $json['consultationId']);
        $stmt->bindValue(":temperature",      $json['temperature']      ?? null);
        $stmt->bindValue(":bloodPressure",    $json['bloodPressure']    ?? null);
        $stmt->bindValue(":heartRate",        $json['heartRate']        ?? null);
        $stmt->bindValue(":respiratoryRate",  $json['respiratoryRate']  ?? null);
        $stmt->bindValue(":oxygenSaturation", $json['oxygenSaturation'] ?? null);
        $stmt->bindValue(":weight",           $json['weight']           ?? null);
        $stmt->bindValue(":height",           $json['height']           ?? null);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    // Updates an existing vital sign record.
    function updateVitalSign($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);

        $sql = "UPDATE VITAL_SIGN SET
                    Temperature       = :temperature,
                    BloodPressure     = :bloodPressure,
                    HeartRate         = :heartRate,
                    RespiratoryRate   = :respiratoryRate,
                    OxygenSaturation  = :oxygenSaturation,
                    Weight            = :weight,
                    Height            = :height
                WHERE VitalSignID = :vitalSignId";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(":temperature",      $json['temperature']      ?? null);
        $stmt->bindValue(":bloodPressure",    $json['bloodPressure']    ?? null);
        $stmt->bindValue(":heartRate",        $json['heartRate']        ?? null);
        $stmt->bindValue(":respiratoryRate",  $json['respiratoryRate']  ?? null);
        $stmt->bindValue(":oxygenSaturation", $json['oxygenSaturation'] ?? null);
        $stmt->bindValue(":weight",           $json['weight']           ?? null);
        $stmt->bindValue(":height",           $json['height']           ?? null);
        $stmt->bindParam(":vitalSignId",      $json['vitalSignId']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    // Soft delete — sets Status to Inactive
    function deleteVitalSign($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE VITAL_SIGN SET Status = 'Inactive'
                WHERE VitalSignID = :vitalSignId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":vitalSignId", $json['vitalSignId']);
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

$vitalSign = new VitalSign();
switch ($operation) {
    case "getVitalSign":
        echo $vitalSign->getVitalSign($json);
        break;
    case "insertVitalSign":
        echo $vitalSign->insertVitalSign($json);
        break;
    case "updateVitalSign":
        echo $vitalSign->updateVitalSign($json);
        break;
    case "deleteVitalSign":
        echo $vitalSign->deleteVitalSign($json);
        break;
}
?>
