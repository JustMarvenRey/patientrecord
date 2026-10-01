-- ============================================================
-- LABORATORY TABLE MIGRATION
-- Run this AFTER milestone1-additions.sql
-- Creates the LABORATORY transaction table which stores actual
-- lab results tied to consultations.
-- LABORATORY_TEST (the master/catalog table) must exist first.
-- ============================================================
USE patient_record_system;

CREATE TABLE IF NOT EXISTS LABORATORY (
    LaboratoryID    INT AUTO_INCREMENT PRIMARY KEY,
    ConsultationID  INT NOT NULL,
    TestID          INT NOT NULL,
    TestDate        DATE NOT NULL,
    Result          TEXT,
    ReferenceRange  VARCHAR(100),
    Status          VARCHAR(10) NOT NULL DEFAULT 'Active',
    CONSTRAINT fk_laboratory_consultation
        FOREIGN KEY (ConsultationID) REFERENCES CONSULTATION(ConsultationID),
    CONSTRAINT fk_laboratory_test
        FOREIGN KEY (TestID) REFERENCES LABORATORY_TEST(TestID)
);
