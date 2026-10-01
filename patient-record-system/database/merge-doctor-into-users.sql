-- ============================================================
-- MERGE DOCTOR INTO USERS
-- Run this ONCE on an EXISTING database (one that still has the
-- DOCTOR table). A fresh install does not need it - the updated
-- patient_record_system.sql already builds the merged structure.
--
-- Before:  USERS <--- DOCTOR <---> DOCTOR_SPECIALIZATION <---> SPECIALIZATION
-- After:   USERS <---------------> DOCTOR_SPECIALIZATION <---> SPECIALIZATION
--
-- A "doctor" is now simply a USERS row whose role is 'Doctor'.
--   - DOCTOR.Phone            -> USERS.Phone
--   - DOCTOR_SPECIALIZATION   -> now points at UserID instead of DoctorID
--   - DOCTOR table            -> dropped
-- Nothing else (appointments, consultations, billing) referenced
-- DOCTOR, so no other table is affected. Back up first anyway.
-- ============================================================
USE patient_record_system;

-- 1. Phone now lives on USERS (nullable, same size as before)
ALTER TABLE users ADD COLUMN Phone VARCHAR(20) NULL AFTER LastName;

-- 2. Carry every doctor's phone number over
UPDATE users u
INNER JOIN doctor d ON d.UserID = u.UserID
SET u.Phone = d.Phone;

-- 3. Re-point the specialization junction from DoctorID to UserID
ALTER TABLE doctor_specialization DROP FOREIGN KEY doctor_specialization_ibfk_1;
ALTER TABLE doctor_specialization ADD COLUMN UserID INT NULL AFTER DoctorSpecializationID;

UPDATE doctor_specialization ds
INNER JOIN doctor d ON d.DoctorID = ds.DoctorID
SET ds.UserID = d.UserID;

ALTER TABLE doctor_specialization DROP INDEX uq_doctor_specialization;
ALTER TABLE doctor_specialization DROP COLUMN DoctorID;
ALTER TABLE doctor_specialization MODIFY UserID INT NOT NULL;
ALTER TABLE doctor_specialization ADD UNIQUE KEY uq_user_specialization (UserID, SpecializationID);
ALTER TABLE doctor_specialization ADD CONSTRAINT fk_doctor_specialization_user
    FOREIGN KEY (UserID) REFERENCES users (UserID);

-- 4. The DOCTOR table is no longer needed
DROP TABLE doctor;
