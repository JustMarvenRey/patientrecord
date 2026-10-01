-- ============================================================
-- APPOINTMENT + CONSULTATION tables (Milestone 2)
-- Run this file against patient_record_system after the base
-- schema (patient_record_system.sql) has already been applied.
-- ============================================================

-- ------------------------------------------------------------
-- APPOINTMENT
-- Links a PATIENT to a USERS row (a Doctor account).
-- Status lifecycle: Scheduled → Completed | Cancelled | No-Show
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS APPOINTMENT (
    AppointmentID   INT AUTO_INCREMENT PRIMARY KEY,
    PatientID       INT NOT NULL,
    UserID          INT NOT NULL,   -- the Doctor (USERS.UserID where RoleID = Doctor)
    AppointmentDate DATE NOT NULL,
    AppointmentTime TIME NOT NULL,
    Reason          VARCHAR(255),
    Status          VARCHAR(20) NOT NULL DEFAULT 'Scheduled', -- Scheduled | Completed | Cancelled | No-Show
    Notes           TEXT,
    FOREIGN KEY (PatientID) REFERENCES PATIENT(PatientID),
    FOREIGN KEY (UserID)    REFERENCES USERS(UserID)
);

-- Sample appointments (use patient IDs 1-9, doctor userIDs from seed data)
INSERT INTO APPOINTMENT (PatientID, UserID, AppointmentDate, AppointmentTime, Reason, Status) VALUES
(1, (SELECT UserID FROM USERS WHERE Username = 'jramirez'),  '2026-09-01', '08:00:00', 'Fever and cough',        'Completed'),
(2, (SELECT UserID FROM USERS WHERE Username = 'jramirez'),  '2026-09-03', '09:00:00', 'Hypertension follow-up', 'Completed'),
(3, (SELECT UserID FROM USERS WHERE Username = 'cbautista'), '2026-09-05', '10:00:00', 'Pediatric check-up',     'Completed'),
(4, (SELECT UserID FROM USERS WHERE Username = 'rnavarro'),  '2026-09-08', '11:00:00', 'Chest pain',             'Completed'),
(5, (SELECT UserID FROM USERS WHERE Username = 'jramirez'),  '2026-09-10', '08:30:00', 'Diabetes management',    'Scheduled'),
(6, (SELECT UserID FROM USERS WHERE Username = 'jramirez'),  '2026-09-15', '09:30:00', 'Back pain',              'Scheduled'),
(7, (SELECT UserID FROM USERS WHERE Username = 'cbautista'), '2026-09-16', '10:30:00', 'Allergic reaction',      'Scheduled'),
(8, (SELECT UserID FROM USERS WHERE Username = 'icruz'),     '2026-09-17', '11:30:00', 'OB follow-up',           'Scheduled'),
(9, (SELECT UserID FROM USERS WHERE Username = 'rnavarro'),  '2026-09-18', '13:00:00', 'Cardiac check-up',       'Scheduled');

-- ------------------------------------------------------------
-- CONSULTATION
-- Created by the Doctor after the appointment takes place.
-- One consultation per appointment (1-to-1).
-- Status: Active | Inactive (soft delete)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS CONSULTATION (
    ConsultationID   INT AUTO_INCREMENT PRIMARY KEY,
    AppointmentID    INT NOT NULL UNIQUE,   -- 1-to-1 with APPOINTMENT
    ConsultationDate DATE NOT NULL,
    ChiefComplaint   TEXT,
    Symptoms         TEXT,
    Treatment        TEXT,
    Notes            TEXT,
    Status           VARCHAR(10) NOT NULL DEFAULT 'Active',
    FOREIGN KEY (AppointmentID) REFERENCES APPOINTMENT(AppointmentID)
);

-- Sample consultations only for Completed appointments
INSERT INTO CONSULTATION (AppointmentID, ConsultationDate, ChiefComplaint, Symptoms, Treatment, Notes, Status) VALUES
(1, '2026-09-01', 'Fever and cough',         'Temperature 38.5°C, dry cough, sore throat',         'Paracetamol 500mg, rest, increase fluid intake', 'Advised to return if fever persists beyond 3 days', 'Active'),
(2, '2026-09-03', 'Hypertension follow-up',  'BP 150/90 mmHg, mild headache',                      'Losartan 50mg once daily continued',             'Patient reminded to limit salt and exercise regularly', 'Active'),
(3, '2026-09-05', 'Routine pediatric visit', 'No acute complaints; mild congestion noted',          'Saline nasal drops, vitamin supplementation',   'Growth and development within normal limits', 'Active'),
(4, '2026-09-08', 'Chest pain',              'Intermittent chest tightness, exertional dyspnea',   'ECG ordered; advised low-sodium diet',           'Referral for stress test pending results', 'Active');
