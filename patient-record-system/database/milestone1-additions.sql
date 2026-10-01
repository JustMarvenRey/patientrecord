-- ============================================================
-- MILESTONE 1 ADDITIONS - run this AFTER patient_record_system.sql
-- Adds the master tables/columns introduced in the revised ERD:
--   - ROLE.Status            (soft delete for roles)
--   - USERS.Phone            (contact number, per revised ERD)
--   - GENERIC (new master table, referenced by MEDICINE)
--   - MEDICINE.GenericID     (FK to GENERIC, nullable so existing
--                             medicine rows don't break)
--   - LABORATORY_TEST (new master table, referenced by LABORATORY)
-- ============================================================
USE patient_record_system;

-- ------------------------------------------------------------
-- ROLE.Status
-- The revised ERD adds Status to ROLE. A role is referenced by
-- USERS.RoleID (NOT NULL), so it is SOFT DELETED - deactivating
-- a role just hides it from the "assign a role" picker for new
-- accounts; existing accounts keep their RoleID unaffected.
-- ------------------------------------------------------------
ALTER TABLE ROLE ADD COLUMN Status VARCHAR(10) NOT NULL DEFAULT 'Active';

-- NOTE: USERS.Phone and the removal of the separate DOCTOR table are already part of
-- patient_record_system.sql (fresh installs). For a database that still has the DOCTOR
-- table, run merge-doctor-into-users.sql instead.

-- ------------------------------------------------------------
-- GENERIC (new master/lookup table)
-- Referenced by MEDICINE.GenericID, and medicines are in turn
-- referenced by PRESCRIPTION history, so this is SOFT DELETED -
-- see api/generics.php for the guard logic.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS GENERIC (
    GenericID   INT AUTO_INCREMENT PRIMARY KEY,
    GenericName VARCHAR(150) NOT NULL,
    Description TEXT,
    Status      VARCHAR(10) NOT NULL DEFAULT 'Active'
);

INSERT INTO GENERIC (GenericName, Description, Status) VALUES
('Paracetamol',   'Analgesic and antipyretic',                         'Active'),
('Amoxicillin',   'Beta-lactam antibiotic',                            'Active'),
('Cetirizine',    'Second-generation antihistamine',                   'Active'),
('Losartan',      'Angiotensin II receptor blocker',                   'Active'),
('Metformin',     'Biguanide used for type 2 diabetes',                'Active'),
('Salbutamol',    'Short-acting beta-2 agonist bronchodilator',        'Active'),
('Omeprazole',    'Proton pump inhibitor',                             'Active'),
('Ascorbic Acid', 'Vitamin C',                                         'Active'),
('Ceftriaxone',   'Third-generation cephalosporin antibiotic',         'Inactive');

-- ------------------------------------------------------------
-- MEDICINE.GenericID
-- Nullable so existing MEDICINE rows (inserted before this
-- migration) remain valid without having to be backfilled first.
-- ------------------------------------------------------------
ALTER TABLE MEDICINE ADD COLUMN GenericID INT NULL AFTER MedicineID;
ALTER TABLE MEDICINE ADD CONSTRAINT fk_medicine_generic
    FOREIGN KEY (GenericID) REFERENCES GENERIC(GenericID);

-- Link the sample medicines to their matching generic where the names line up
UPDATE MEDICINE m JOIN GENERIC g ON m.MedicineName LIKE CONCAT(g.GenericName, '%')
SET m.GenericID = g.GenericID;

-- ------------------------------------------------------------
-- LABORATORY_TEST (new master/lookup table)
-- Referenced by LABORATORY.TestID (actual test results tied to
-- real consultations), so this is SOFT DELETED - see
-- api/laboratory-tests.php for details.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS LABORATORY_TEST (
    TestID      INT AUTO_INCREMENT PRIMARY KEY,
    TestName    VARCHAR(150) NOT NULL,
    Description TEXT,
    NormalRange VARCHAR(100),
    Status      VARCHAR(10) NOT NULL DEFAULT 'Active'
);

INSERT INTO LABORATORY_TEST (TestName, Description, NormalRange, Status) VALUES
('Complete Blood Count (CBC)', 'Measures red/white blood cells and platelets', 'Varies by component', 'Active'),
('Fasting Blood Sugar',        'Measures blood glucose after fasting',          '70-100 mg/dL',        'Active'),
('Urinalysis',                 'Physical, chemical, and microscopic exam of urine', 'Varies by component', 'Active'),
('Lipid Profile',              'Measures cholesterol and triglycerides',        'Varies by component',  'Active'),
('Chest X-Ray',                'Imaging of the chest, lungs, and heart',        'No abnormal findings', 'Active'),
('HbA1c',                      'Average blood sugar over the past 2-3 months',  '4-5.6%',                'Active'),
('Liver Function Test',        'Measures liver enzymes and function',           'Varies by component',  'Active'),
('Kidney Function Test',       'Measures creatinine and BUN',                   'Varies by component',  'Active'),
('Pregnancy Test (Urine)',     'Detects hCG hormone in urine',                  'Negative',              'Active'),
('COVID-19 Antigen Test',      'Rapid detection of SARS-CoV-2 antigen',         'Negative',              'Inactive');
