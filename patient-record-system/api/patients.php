<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Patient {

    // Phone is optional, but if the admin does type one in it must be
    // 7-15 digits only - no "-", "+", letters, spaces, etc. This is what
    // blocks a negative number (or any other garbage) from being saved.
    private function isValidPhone($phone) {
        $phone = trim($phone ?? "");
        return $phone === "" || preg_match('/^[0-9]{7,15}$/', $phone) === 1;
    }

    // GenderDetails is only meaningful (and required) when Gender = 'Other'.
    // For Male/Female it's always stored as NULL so it can't get out of sync
    // with a Gender value it doesn't apply to.
    private function resolveGenderDetails($json) {
        $gender = $json['gender'] ?? "";
        $details = trim($json['genderDetails'] ?? "");
        if ($gender !== "Other") {
            return [true, null];
        }
        if ($details === "") {
            return [false, null];
        }
        return [true, $details];
    }

    // Returns ALL patients (Active + Inactive) - used by the admin master file screen
    function getAllPatients() {
        include "connection-pdo.php";
        $sql = "SELECT * FROM PATIENT ORDER BY LastName, FirstName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    // Returns only Active patients - this is what transaction modules
    // (Appointments, Consultations, Billing) should call when they need
    // to let a user pick a patient.
    function getActivePatients() {
        include "connection-pdo.php";
        $sql = "SELECT * FROM PATIENT WHERE Status = 'Active' ORDER BY LastName, FirstName";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    function getPatient($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT * FROM PATIENT WHERE PatientID = :patientId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":patientId", $json['patientId']);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }

    function insertPatient($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);

        if (!$this->isValidPhone($json['phone'])) {
            return json_encode(["error" => "invalid_phone"]);
        }

        list($genderOk, $genderDetails) = $this->resolveGenderDetails($json);
        if (!$genderOk) {
            return json_encode(["error" => "gender_details_required"]);
        }

        $sql = "INSERT INTO PATIENT (FirstName, LastName, DateOfBirth, Gender, GenderDetails, Phone, Address, Status)
                VALUES (:firstName, :lastName, :dob, :gender, :genderDetails, :phone, :address, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":firstName", $json['firstName']);
        $stmt->bindParam(":lastName", $json['lastName']);
        $stmt->bindParam(":dob", $json['dob']);
        $stmt->bindParam(":gender", $json['gender']);
        $stmt->bindParam(":genderDetails", $genderDetails);
        $stmt->bindParam(":phone", $json['phone']);
        $stmt->bindParam(":address", $json['address']);
        $stmt->execute();

        $returnValue = 0;
        if ($stmt->rowCount() > 0) {
            $returnValue = 1;
        }
        return json_encode($returnValue);
    }

    function updatePatient($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);

        if (!$this->isValidPhone($json['phone'])) {
            return json_encode(["error" => "invalid_phone"]);
        }

        list($genderOk, $genderDetails) = $this->resolveGenderDetails($json);
        if (!$genderOk) {
            return json_encode(["error" => "gender_details_required"]);
        }

        $sql = "UPDATE PATIENT SET
                    FirstName = :firstName,
                    LastName = :lastName,
                    DateOfBirth = :dob,
                    Gender = :gender,
                    GenderDetails = :genderDetails,
                    Phone = :phone,
                    Address = :address
                WHERE PatientID = :patientId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":firstName", $json['firstName']);
        $stmt->bindParam(":lastName", $json['lastName']);
        $stmt->bindParam(":dob", $json['dob']);
        $stmt->bindParam(":gender", $json['gender']);
        $stmt->bindParam(":genderDetails", $genderDetails);
        $stmt->bindParam(":phone", $json['phone']);
        $stmt->bindParam(":address", $json['address']);
        $stmt->bindParam(":patientId", $json['patientId']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    // SOFT DELETE: patients are referenced by Appointments, Consultations
    // and Billing, so we never physically remove the row. We just mark it
    // Inactive so it drops out of transaction pickers but historical
    // records that point to this PatientID stay valid.
    function deletePatient($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE PATIENT SET Status = 'Inactive' WHERE PatientID = :patientId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":patientId", $json['patientId']);
        $stmt->execute();

        $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
        return json_encode($returnValue);
    }

    // Reverses a soft delete

    // Full medical history for a patient — all consultations with vitals, diagnoses, labs, prescriptions
    function getPatientMedicalHistory($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $patientId = $json['patientId'];

        // Consultations (with appointment + doctor info)
        $sqlC = "SELECT
                    c.ConsultationID, c.ConsultationDate, c.ChiefComplaint,
                    c.Symptoms, c.Treatment, c.Notes, c.Status,
                    a.AppointmentDate, a.AppointmentTime, a.Reason,
                    CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName
                 FROM CONSULTATION c
                 JOIN APPOINTMENT a ON c.AppointmentID = a.AppointmentID
                 JOIN USERS u       ON a.UserID        = u.UserID
                 WHERE a.PatientID = :patientId AND c.Status = 'Active'
                 ORDER BY c.ConsultationDate DESC";
        $stmtC = $conn->prepare($sqlC);
        $stmtC->bindParam(":patientId", $patientId);
        $stmtC->execute();
        $consultations = $stmtC->fetchAll(PDO::FETCH_ASSOC);

        // For each consultation, attach vitals, diagnoses, labs, prescriptions
        foreach ($consultations as &$con) {
            $cid = $con['ConsultationID'];

            // Vitals
            $sv = $conn->prepare("SELECT * FROM VITAL_SIGN WHERE ConsultationID = :cid");
            $sv->bindParam(":cid", $cid); $sv->execute();
            $con['vitals'] = $sv->fetchAll(PDO::FETCH_ASSOC);

            // Diagnoses
            $sd = $conn->prepare(
                "SELECT d.ICD10Code, d.DiagnosisName FROM CONSULTATION_DIAGNOSIS cd
                 JOIN DIAGNOSIS_ICD10 d ON cd.DiagnosisID = d.DiagnosisID
                 WHERE cd.ConsultationID = :cid AND cd.Status = 'Active'"
            );
            $sd->bindParam(":cid", $cid); $sd->execute();
            $con['diagnoses'] = $sd->fetchAll(PDO::FETCH_ASSOC);

            // Lab results
            $sl = $conn->prepare(
                "SELECT lt.TestName, l.TestDate, l.Result, l.ReferenceRange
                 FROM LABORATORY l JOIN LABORATORY_TEST lt ON l.TestID = lt.TestID
                 WHERE l.ConsultationID = :cid AND l.Status = 'Active'"
            );
            $sl->bindParam(":cid", $cid); $sl->execute();
            $con['labs'] = $sl->fetchAll(PDO::FETCH_ASSOC);

            // Prescriptions
            $sp = $conn->prepare(
                "SELECT m.MedicineName, g.GenericName, m.DosageForm,
                        p.Dosage, p.Frequency, p.Duration, p.Instructions
                 FROM PRESCRIPTION p
                 JOIN MEDICINE m ON p.MedicineID = m.MedicineID
                 JOIN GENERIC  g ON m.GenericID  = g.GenericID
                 WHERE p.ConsultationID = :cid AND p.Status = 'Active'"
            );
            $sp->bindParam(":cid", $cid); $sp->execute();
            $con['prescriptions'] = $sp->fetchAll(PDO::FETCH_ASSOC);
        }

        return json_encode($consultations);
    }

    // Appointments on record for a patient - used by the medical history page
    // as a fallback when the patient has no consultations yet.
    function getPatientAppointments($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "SELECT a.AppointmentID, a.AppointmentDate, a.AppointmentTime, a.Reason, a.Status,
                       CONCAT(u.LastName, ', ', u.FirstName) AS DoctorName
                FROM APPOINTMENT a
                JOIN USERS u ON a.UserID = u.UserID
                WHERE a.PatientID = :patientId
                ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":patientId", $json['patientId']);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function restorePatient($json) {
        include "connection-pdo.php";
        $json = json_decode($json, true);
        $sql = "UPDATE PATIENT SET Status = 'Active' WHERE PatientID = :patientId";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":patientId", $json['patientId']);
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

$patient = new Patient();
switch ($operation) {
    case "getAllPatients":
        echo $patient->getAllPatients();
        break;
    case "getActivePatients":
        echo $patient->getActivePatients();
        break;
    case "getPatient":
        echo $patient->getPatient($json);
        break;
    case "insertPatient":
        echo $patient->insertPatient($json);
        break;
    case "updatePatient":
        echo $patient->updatePatient($json);
        break;
    case "deletePatient":
        echo $patient->deletePatient($json);
        break;
    case "getPatientMedicalHistory": echo $patient->getPatientMedicalHistory($json); break;
    case "getPatientAppointments": echo $patient->getPatientAppointments($json); break;
    case "restorePatient":
        echo $patient->restorePatient($json);
        break;
}
?>
