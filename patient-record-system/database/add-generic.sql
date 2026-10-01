-- ============================================================
-- ADD GENERIC - run this ONLY if you already imported
-- patient_record_system.sql before this update (that file now
-- creates GENERIC and MEDICINE.GenericID directly, so a fresh
-- import doesn't need this).
-- ============================================================
USE patient_record_system;

CREATE TABLE IF NOT EXISTS GENERIC (
    GenericID   INT AUTO_INCREMENT PRIMARY KEY,
    GenericName VARCHAR(150) NOT NULL,
    Description TEXT,
    Status      VARCHAR(10) NOT NULL DEFAULT 'Active'
);

INSERT INTO GENERIC (GenericName, Description, Status) VALUES
('Paracetamol',   'Analgesic and antipyretic',                  'Active'),
('Amoxicillin',   'Beta-lactam antibiotic',                     'Active'),
('Cetirizine',    'Second-generation antihistamine',            'Active'),
('Losartan',      'Angiotensin II receptor blocker',            'Active'),
('Metformin',     'Biguanide used for type 2 diabetes',         'Active'),
('Salbutamol',    'Short-acting beta-2 agonist bronchodilator', 'Active'),
('Omeprazole',    'Proton pump inhibitor',                      'Active'),
('Ascorbic Acid', 'Vitamin C',                                  'Active'),
('Ceftriaxone',   'Third-generation cephalosporin antibiotic',  'Inactive');

ALTER TABLE MEDICINE ADD COLUMN GenericID INT NULL AFTER MedicineID;
ALTER TABLE MEDICINE ADD CONSTRAINT fk_medicine_generic
    FOREIGN KEY (GenericID) REFERENCES GENERIC(GenericID);

-- Link existing medicines to their matching generic where the names line up
UPDATE MEDICINE m JOIN GENERIC g ON m.MedicineName LIKE CONCAT(g.GenericName, '%')
SET m.GenericID = g.GenericID;
