<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Prescription {

    // Get all prescriptions for a consultation
    function getPrescriptionsByConsultation($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT p.PrescriptionID, p.ConsultationID, p.MedicineID, p.PrescriptionDate,
                       p.Dosage, p.Frequency, p.Duration, p.Instructions, p.Status,
                       m.MedicineName, m.DosageForm, g.GenericName
                FROM PRESCRIPTION p
                JOIN MEDICINE m ON p.MedicineID = m.MedicineID
                JOIN GENERIC  g ON m.GenericID  = g.GenericID
                WHERE p.ConsultationID = :consultationId AND p.Status = 'Active'
                ORDER BY p.PrescriptionDate DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId", $json['consultationId']);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // Add a prescription line to a consultation
    function insertPrescription($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "INSERT INTO PRESCRIPTION
                    (ConsultationID, MedicineID, PrescriptionDate, Dosage, Frequency, Duration, Instructions, Status)
                VALUES
                    (:consultationId, :medicineId, :prescriptionDate, :dosage, :frequency, :duration, :instructions, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":consultationId",   $json['consultationId']);
        $stmt->bindParam(":medicineId",       $json['medicineId']);
        $stmt->bindParam(":prescriptionDate", $json['prescriptionDate']);
        $stmt->bindValue(":dosage",           $json['dosage']        ?? null);
        $stmt->bindValue(":frequency",        $json['frequency']     ?? null);
        $stmt->bindValue(":duration",         $json['duration']      ?? null);
        $stmt->bindValue(":instructions",     $json['instructions']  ?? null);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Update an existing prescription
    function updatePrescription($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE PRESCRIPTION SET
                    MedicineID       = :medicineId,
                    PrescriptionDate = :prescriptionDate,
                    Dosage           = :dosage,
                    Frequency        = :frequency,
                    Duration         = :duration,
                    Instructions     = :instructions
                WHERE PrescriptionID = :prescriptionId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":medicineId",       $json['medicineId']);
        $stmt->bindParam(":prescriptionDate", $json['prescriptionDate']);
        $stmt->bindValue(":dosage",           $json['dosage']       ?? null);
        $stmt->bindValue(":frequency",        $json['frequency']    ?? null);
        $stmt->bindValue(":duration",         $json['duration']     ?? null);
        $stmt->bindValue(":instructions",     $json['instructions'] ?? null);
        $stmt->bindParam(":prescriptionId",   $json['prescriptionId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Soft delete
    function removePrescription($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE PRESCRIPTION SET Status = 'Inactive' WHERE PrescriptionID = :prescriptionId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":prescriptionId", $json['prescriptionId']);
        $stmt->execute();
        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    // Get all active medicines for the dropdown
    function getActiveMedicines() {
        include "connection-pdo.php";
        $sql = "SELECT m.MedicineID, m.MedicineName, m.DosageForm, g.GenericName
                FROM MEDICINE m JOIN GENERIC g ON m.GenericID = g.GenericID
                WHERE m.Status = 'Active' ORDER BY m.MedicineName";
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

$rx = new Prescription();
switch ($operation) {
    case "getPrescriptionsByConsultation": echo $rx->getPrescriptionsByConsultation($json); break;
    case "insertPrescription":             echo $rx->insertPrescription($json);             break;
    case "updatePrescription":             echo $rx->updatePrescription($json);             break;
    case "removePrescription":             echo $rx->removePrescription($json);             break;
    case "getActiveMedicines":             echo $rx->getActiveMedicines();                  break;
}
?>
