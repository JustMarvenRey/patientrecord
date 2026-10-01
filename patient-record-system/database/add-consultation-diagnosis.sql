-- ============================================================
-- CONSULTATION_DIAGNOSIS table (run after add-consultations.sql)
-- Links ICD-10 diagnosis codes to a specific consultation.
-- A consultation can have MULTIPLE diagnoses (one-to-many).
-- Status enables soft delete so clinical history stays intact
-- if a diagnosis entry is removed by mistake.
-- ============================================================

USE patient_record_system;

CREATE TABLE IF NOT EXISTS CONSULTATION_DIAGNOSIS (
    ConsultationDiagnosisID INT AUTO_INCREMENT PRIMARY KEY,
    ConsultationID          INT NOT NULL,
    DiagnosisID             INT NOT NULL,
    Status                  VARCHAR(10) NOT NULL DEFAULT 'Active',
    FOREIGN KEY (ConsultationID) REFERENCES CONSULTATION(ConsultationID),
    FOREIGN KEY (DiagnosisID)    REFERENCES DIAGNOSIS_ICD10(DiagnosisID),
    UNIQUE KEY uq_consult_diagnosis (ConsultationID, DiagnosisID)
);

-- Sample diagnoses linked to the 4 existing consultations
INSERT INTO CONSULTATION_DIAGNOSIS (ConsultationID, DiagnosisID, Status) VALUES
(1, (SELECT DiagnosisID FROM DIAGNOSIS_ICD10 WHERE ICD10Code = 'J00'),   'Active'),  -- Fever/cough → Common cold
(1, (SELECT DiagnosisID FROM DIAGNOSIS_ICD10 WHERE ICD10Code = 'J02.9'), 'Active'),  -- Fever/cough → Pharyngitis
(2, (SELECT DiagnosisID FROM DIAGNOSIS_ICD10 WHERE ICD10Code = 'I10'),   'Active'),  -- Hypertension → Essential hypertension
(3, (SELECT DiagnosisID FROM DIAGNOSIS_ICD10 WHERE ICD10Code = 'J00'),   'Active'),  -- Pediatric → Common cold
(4, (SELECT DiagnosisID FROM DIAGNOSIS_ICD10 WHERE ICD10Code = 'I10'),   'Active');  -- Chest pain → Hypertension
