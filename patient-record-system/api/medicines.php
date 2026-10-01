<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Medicine {

    // Returns ALL medicines (Active + Inactive) - used by the admin master file screen
    function getAllMedicines() {
        include "connection-pdo.php";
        $sql = "SELECT m.*, g.GenericName
                FROM MEDICINE m
                LEFT JOIN GENERIC g ON g.GenericID = m.GenericID
                ORDER BY m.MedicineName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    // Returns only Active medicines - this is what transaction modules
    // (Prescriptions) should call when they need to let a user pick a medicine.
    function getActiveMedicines() {
        include "connection-pdo.php";
        $sql = "SELECT m.*, g.GenericName
                FROM MEDICINE m
                LEFT JOIN GENERIC g ON g.GenericID = m.GenericID
                WHERE m.Status = 'Active'
                ORDER BY m.MedicineName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    function getMedicine($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT m.*, g.GenericName
                FROM MEDICINE m
                LEFT JOIN GENERIC g ON g.GenericID = m.GenericID
                WHERE m.MedicineID = :medicineId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":medicineId", $json['medicineId']);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    function insertMedicine($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $genericId = !empty($json['genericId']) ? $json['genericId'] : null;
        $sql = "INSERT INTO MEDICINE (GenericID, MedicineName, Description, DosageForm, Status)
                VALUES (:genericId, :medicineName, :description, :dosageForm, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":genericId", $genericId);
        $stmt->bindParam(":medicineName", $json['medicineName']);
        $stmt->bindParam(":description", $json['description']);
        $stmt->bindParam(":dosageForm", $json['dosageForm']);
        $stmt->execute();

        $returnValue = 0;
        if ($stmt->rowCount() > 0) {
            $returnValue = 1;
        }
        return json_encode($returnValue);
    }

    function updateMedicine($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $genericId = !empty($json['genericId']) ? $json['genericId'] : null;
        $sql = "UPDATE MEDICINE SET
                    GenericID = :genericId,
                    MedicineName = :medicineName,
                    Description = :description,
                    DosageForm = :dosageForm
                WHERE MedicineID = :medicineId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":genericId", $genericId);
        $stmt->bindParam(":medicineName", $json['medicineName']);
        $stmt->bindParam(":description", $json['description']);
        $stmt->bindParam(":dosageForm", $json['dosageForm']);
        $stmt->bindParam(":medicineId", $json['medicineId']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    // SOFT DELETE: medicines are referenced by PRESCRIPTION, so we
    // never physically remove the row. We just mark it Inactive so
    // it drops out of transaction pickers but historical prescriptions
    // that point to this MedicineID stay valid.
    function deleteMedicine($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE MEDICINE SET Status = 'Inactive' WHERE MedicineID = :medicineId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":medicineId", $json['medicineId']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    // Reverses a soft delete
    function restoreMedicine($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE MEDICINE SET Status = 'Active' WHERE MedicineID = :medicineId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":medicineId", $json['medicineId']);
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

$medicine = new Medicine();
switch ($operation) {
    case "getAllMedicines":
        echo $medicine->getAllMedicines();
        break;
    case "getActiveMedicines":
        echo $medicine->getActiveMedicines();
        break;
    case "getMedicine":
        echo $medicine->getMedicine($json);
        break;
    case "insertMedicine":
        echo $medicine->insertMedicine($json);
        break;
    case "updateMedicine":
        echo $medicine->updateMedicine($json);
        break;
    case "deleteMedicine":
        echo $medicine->deleteMedicine($json);
        break;
    case "restoreMedicine":
        echo $medicine->restoreMedicine($json);
        break;
}
?>
