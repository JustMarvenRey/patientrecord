-- ============================================================
-- VITAL_SIGN table (run after add-consultations.sql)
-- One VITAL_SIGN row per CONSULTATION. A doctor records vital
-- signs when they open a consultation. Status enables soft
-- delete (though in practice vital signs are rarely removed —
-- they are clinical records). 1-to-1 with CONSULTATION via
-- the UNIQUE constraint on ConsultationID.
-- ============================================================

USE patient_record_system;

CREATE TABLE IF NOT EXISTS VITAL_SIGN (
    VitalSignID       INT AUTO_INCREMENT PRIMARY KEY,
    ConsultationID    INT NOT NULL UNIQUE,          -- 1-to-1 with CONSULTATION
    Temperature       DECIMAL(4,1),                 -- °C, e.g. 36.8
    BloodPressure     VARCHAR(20),                  -- e.g. "120/80"
    HeartRate         INT,                          -- bpm
    RespiratoryRate   INT,                          -- breaths/min
    OxygenSaturation  INT,                          -- SpO2 %, e.g. 98
    Weight            DECIMAL(5,2),                 -- kg
    Height            DECIMAL(5,2),                 -- cm
    Status            VARCHAR(10) NOT NULL DEFAULT 'Active',
    FOREIGN KEY (ConsultationID) REFERENCES CONSULTATION(ConsultationID)
);

-- Sample vital signs for the 4 existing consultations
INSERT INTO VITAL_SIGN (ConsultationID, Temperature, BloodPressure, HeartRate, RespiratoryRate, OxygenSaturation, Weight, Height, Status) VALUES
(1, 38.5, '110/70', 95,  18, 97, 62.0, 162.0, 'Active'),  -- Fever / cough
(2, 36.8, '150/90', 80,  16, 98, 75.5, 170.0, 'Active'),  -- Hypertension follow-up
(3, 36.6, '90/60',  88,  20, 99, 18.5, 105.0, 'Active'),  -- Pediatric check-up
(4, 37.0, '130/85', 102, 22, 95, 80.0, 175.0, 'Active');  -- Chest pain
