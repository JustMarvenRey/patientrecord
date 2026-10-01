-- ============================================================
-- PRESCRIPTION + BILLING + PROFESSIONAL_FEE tables
-- Run after add-consultations.sql and add-consultation-diagnosis.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS PRESCRIPTION (
    PrescriptionID   INT AUTO_INCREMENT PRIMARY KEY,
    ConsultationID   INT NOT NULL,
    MedicineID       INT NOT NULL,
    PrescriptionDate DATE NOT NULL,
    Dosage           VARCHAR(100),
    Frequency        VARCHAR(100),
    Duration         VARCHAR(100),
    Instructions     TEXT,
    Status           VARCHAR(10) NOT NULL DEFAULT 'Active',
    FOREIGN KEY (ConsultationID) REFERENCES CONSULTATION(ConsultationID),
    FOREIGN KEY (MedicineID)     REFERENCES MEDICINE(MedicineID)
);

CREATE TABLE IF NOT EXISTS BILLING (
    BillID         INT AUTO_INCREMENT PRIMARY KEY,
    ConsultationID INT NOT NULL UNIQUE,
    BillDate       DATE NOT NULL,
    TotalAmount    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    Status         VARCHAR(20) NOT NULL DEFAULT 'Pending',  -- Pending | Paid | Cancelled
    FOREIGN KEY (ConsultationID) REFERENCES CONSULTATION(ConsultationID)
);

CREATE TABLE IF NOT EXISTS PROFESSIONAL_FEE (
    ProfessionalFeeID INT AUTO_INCREMENT PRIMARY KEY,
    BillID            INT NOT NULL,
    UserID            INT NOT NULL,
    FeeAmount         DECIMAL(10,2) NOT NULL,
    Description       TEXT,
    Status            VARCHAR(10) NOT NULL DEFAULT 'Active',
    FOREIGN KEY (BillID)  REFERENCES BILLING(BillID),
    FOREIGN KEY (UserID)  REFERENCES USERS(UserID)
);
