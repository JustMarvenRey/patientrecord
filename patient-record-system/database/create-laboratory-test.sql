-- ============================================================
-- Run this in phpMyAdmin → patient_record_system database
-- SQL tab → paste this → click GO
-- ============================================================
USE patient_record_system;

CREATE TABLE IF NOT EXISTS LABORATORY_TEST (
    TestID      INT AUTO_INCREMENT PRIMARY KEY,
    TestName    VARCHAR(150) NOT NULL,
    Description TEXT,
    NormalRange VARCHAR(100),
    Status      VARCHAR(10) NOT NULL DEFAULT 'Active'
);

INSERT INTO LABORATORY_TEST (TestName, Description, NormalRange, Status) VALUES
('Complete Blood Count (CBC)', 'Measures red/white blood cells and platelets',       'Varies by component',  'Active'),
('Fasting Blood Sugar',        'Measures blood glucose after fasting',                '70-100 mg/dL',         'Active'),
('Urinalysis',                 'Physical, chemical, and microscopic exam of urine',   'Varies by component',  'Active'),
('Lipid Profile',              'Measures cholesterol and triglycerides',              'Varies by component',  'Active'),
('Chest X-Ray',                'Imaging of the chest, lungs, and heart',             'No abnormal findings', 'Active'),
('HbA1c',                      'Average blood sugar over the past 2-3 months',       '4-5.6%',               'Active'),
('Liver Function Test',        'Measures liver enzymes and function',                'Varies by component',  'Active'),
('Kidney Function Test',       'Measures creatinine and BUN',                        'Varies by component',  'Active'),
('Pregnancy Test (Urine)',     'Detects hCG hormone in urine',                       'Negative',             'Active'),
('COVID-19 Antigen Test',      'Rapid detection of SARS-CoV-2 antigen',              'Negative',             'Inactive');
