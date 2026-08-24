-- Afiya AI - Medicines Seed Data (40 Medicines from DRAP Pakistan)
-- Source: https://e.dra.gov.pk/public/price
-- All data extracted from DRAP_40_Medicines_data.json

INSERT INTO medicines (id, brand_name, generic_name, dosage_form, strength, manufacturer, registration_info, aliases, category, verified_at) VALUES
-- ============================================================================
-- Analgesic / Antipyretic (4)
-- ============================================================================
('b0000001-0000-0000-0000-000000000001', 'Panadol', 'Paracetamol', 'Tablet', '500mg', 'GSK Pakistan Limited', '004052',
 '["panadol","paracetamol","acetaminophen","panadole"]', 'Analgesic / Antipyretic', NOW()),

('b0000001-0000-0000-0000-000000000002', 'Brufen', 'Ibuprofen', 'Tablet', '400mg', 'Abbott Laboratories (Pakistan)', '001124',
 '["brufen","ibuprofen","ibuprofene","brufin","advil"]', 'Analgesic / Antipyretic', NOW()),

('b0000001-0000-0000-0000-000000000003', 'Ponstan', 'Mefenamic Acid', 'Tablet', '250mg', 'Pfizer Pakistan Limited', '002598',
 '["ponstan","mefenamic acid","mefenamic","ponstan forte"]', 'Analgesic / Antipyretic', NOW()),

('b0000001-0000-0000-0000-000000000004', 'Disprin', 'Aspirin', 'Tablet', '300mg', 'Reckitt Benckiser Pakistan', '000543',
 '["disprin","aspirin","acetylsalicylic acid","asa","dispirin"]', 'Analgesic / Antipyretic', NOW()),

-- ============================================================================
-- Antibiotic (Broad Spectrum) (4)
-- ============================================================================
('b0000001-0000-0000-0000-000000000005', 'Augmentin', 'Amoxicillin/Clavulanate', 'Tablet', '625mg', 'GSK Pakistan Limited', '008892',
 '["augmentin","amoxicillin clavulanate","amox clav","augmentan","co-amoxiclav"]', 'Antibiotic (Broad Spectrum)', NOW()),

('b0000001-0000-0000-0000-000000000006', 'Amoxil', 'Amoxicillin', 'Capsule', '500mg', 'GSK Pakistan Limited', '003310',
 '["amoxil","amoxicillin","amoxycillin","amox"]', 'Antibiotic (Broad Spectrum)', NOW()),

('b0000001-0000-0000-0000-000000000007', 'Azomax', 'Azithromycin', 'Capsule', '500mg', 'Pfizer Pakistan Limited', '038291',
 '["azomax","azithromycin","zithromax","azithro","azythromycin"]', 'Antibiotic (Broad Spectrum)', NOW()),

('b0000001-0000-0000-0000-000000000008', 'Klaricid', 'Clarithromycin', 'Tablet', '250mg', 'Abbott Laboratories (Pakistan)', '012354',
 '["klaricid","clarithromycin","clarithromycine","klacid"]', 'Antibiotic (Broad Spectrum)', NOW()),

-- ============================================================================
-- Antibiotic (Fluoroquinolone) (3)
-- ============================================================================
('b0000001-0000-0000-0000-000000000009', 'Ciproxin', 'Ciprofloxacin', 'Tablet', '500mg', 'Bayer Pakistan Private Limited', '009934',
 '["ciproxin","ciprofloxacin","cipro","ciprobay","ciprox"]', 'Antibiotic (Fluoroquinolone)', NOW()),

('b0000001-0000-0000-0000-000000000010', 'Novidat', 'Ciprofloxacin', 'Tablet', '250mg', 'Sami Pharma', '019485',
 '["novidat","ciprofloxacin","cipro","novidate"]', 'Antibiotic (Fluoroquinolone)', NOW()),

('b0000001-0000-0000-0000-000000000011', 'Leflox', 'Levofloxacin', 'Tablet', '500mg', 'Getz Pharma (Pvt.) Ltd.', '045612',
 '["leflix","levofloxacin","levaquin","levoquin","levoflox"]', 'Antibiotic (Fluoroquinolone)', NOW()),

-- ============================================================================
-- Antibiotic (Cephalosporin) (1)
-- ============================================================================
('b0000001-0000-0000-0000-000000000012', 'Cefspan', 'Cefixime', 'Capsule', '400mg', 'Martin Dow Limited', '022511',
 '["cefspan","cefixime","cefix","cefsime"]', 'Antibiotic (Cephalosporin)', NOW()),

-- ============================================================================
-- Antacid / Anti-ulcer (4)
-- ============================================================================
('b0000001-0000-0000-0000-000000000013', 'Risek', 'Omeprazole', 'Capsule', '20mg', 'Getz Pharma (Pvt.) Ltd.', '029112',
 '["risek","omeprazole","omeprazol","omez","risek capsule"]', 'Antacid / Anti-ulcer', NOW()),

('b0000001-0000-0000-0000-000000000014', 'Nexum', 'Esomeprazole', 'Capsule', '40mg', 'AstraZeneca Pharmaceuticals', '041285',
 '["nexum","esomeprazole","esomeprazol","nexium","nexum capsule"]', 'Antacid / Anti-ulcer', NOW()),

('b0000001-0000-0000-0000-000000000015', 'Zantac', 'Ranitidine', 'Tablet', '150mg', 'GSK Pakistan Limited', '005912',
 '["zantac","ranitidine","ranitidin","rantidine"]', 'Antacid / Anti-ulcer', NOW()),

('b0000001-0000-0000-0000-000000000016', 'Losec', 'Omeprazole', 'Capsule', '20mg', 'AstraZeneca Pharmaceuticals', '010344',
 '["losec","omeprazole","omeprazol","losec capsule"]', 'Antacid / Anti-ulcer', NOW()),

-- ============================================================================
-- Antihistamine / Anti-allergy (4)
-- ============================================================================
('b0000001-0000-0000-0000-000000000017', 'Rigix', 'Cetirizine', 'Tablet', '10mg', 'AGP Limited', '024519',
 '["rigix","cetirizine","cetrizine","rigix tablet"]', 'Antihistamine / Anti-allergy', NOW()),

('b0000001-0000-0000-0000-000000000018', 'Zyrtec', 'Cetirizine', 'Tablet', '10mg', 'GlaxoSmithKline Pakistan Limited', '015948',
 '["zyrtec","cetirizine","cetrizine","cetirizin","zyrtek"]', 'Antihistamine / Anti-allergy', NOW()),

('b0000001-0000-0000-0000-000000000019', 'Telfast', 'Fexofenadine', 'Tablet', '120mg', 'Sanofi-Aventis Pakistan limited', '038592',
 '["telfast","fexofenadine","fexofenadin","telfast 120"]', 'Antihistamine / Anti-allergy', NOW()),

('b0000001-0000-0000-0000-000000000020', 'Softin', 'Loratadine', 'Tablet', '10mg', 'PHARMEVO (PVT) LTD.', '031948',
 '["softin","loratadine","loratadin","claritin"]', 'Antihistamine / Anti-allergy', NOW()),

-- ============================================================================
-- Anti-diabetic (4)
-- ============================================================================
('b0000001-0000-0000-0000-000000000021', 'Glucophage', 'Metformin', 'Tablet', '500mg', 'Martin Dow Limited', '007812',
 '["glucophage","metformin","metformine","glucophage tablet"]', 'Anti-diabetic', NOW()),

('b0000001-0000-0000-0000-000000000022', 'Amaryl', 'Glimepiride', 'Tablet', '2mg', 'Sanofi-Aventis Pakistan limited', '018593',
 '["amaryl","glimepiride","glimepride","gleamryl"]', 'Anti-diabetic', NOW()),

('b0000001-0000-0000-0000-000000000023', 'Diamicron MR', 'Gliclazide', 'Tablet', '30mg', 'Servier Research and Pharmaceuticals', '025819',
 '["diamicron","gliclazide","diamicron mr","gliclazide mr"]', 'Anti-diabetic', NOW()),

('b0000001-0000-0000-0000-000000000024', 'Janumet', 'Sitagliptin/Metformin', 'Tablet', '50/500mg', 'Organon Pakistan', '058392',
 '["janumet","sitagliptin metformin","sitagliptin","janumet tablet"]', 'Anti-diabetic', NOW()),

-- ============================================================================
-- Anti-hypertensive (4)
-- ============================================================================
('b0000001-0000-0000-0000-000000000025', 'Concor', 'Bisoprolol', 'Tablet', '5mg', 'Merck', '022194',
 '["concor","bisoprolol","bisoprol","concor tablet"]', 'Anti-hypertensive', NOW()),

('b0000001-0000-0000-0000-000000000026', 'Norvasc', 'Amlodipine', 'Tablet', '5mg', 'Pfizer Pakistan Limited', '019482',
 '["norvasc","amlodipine","amlodipin","norvas"]', 'Anti-hypertensive', NOW()),

('b0000001-0000-0000-0000-000000000027', 'Eziday', 'Losartan', 'Tablet', '50mg', 'Werrick Pharmaceuticals', '038194',
 '["eziday","losartan","losartane","cozaar"]', 'Anti-hypertensive', NOW()),

('b0000001-0000-0000-0000-000000000028', 'Tenormin', 'Atenolol', 'Tablet', '50mg', 'Martin Dow Limited', '002495',
 '["tenormin","atenolol","atenol","tenormine"]', 'Anti-hypertensive', NOW()),

-- ============================================================================
-- Antiemetic / GI Tract (4)
-- ============================================================================
('b0000001-0000-0000-0000-000000000029', 'Motilium', 'Domperidone', 'Tablet', '10mg', 'Janssen', '009184',
 '["motilium","domperidone","domperidon","motillium"]', 'Antiemetic / GI Tract', NOW()),

('b0000001-0000-0000-0000-000000000030', 'Gravinate', 'Dimenhydrinate', 'Tablet', '50mg', 'The Searle Company Limited', '001485',
 '["gravinate","dimenhydrinate","dimenhydrinat","dramamine"]', 'Antiemetic / GI Tract', NOW()),

('b0000001-0000-0000-0000-000000000031', 'Flagyl', 'Metronidazole', 'Tablet', '400mg', 'Sanofi-Aventis Pakistan limited', '004812',
 '["flagyl","metronidazole","metronidazol","metrogy"]', 'Antiemetic / GI Tract', NOW()),

('b0000001-0000-0000-0000-000000000032', 'Entamizole', 'Metronidazole/Diloxanide', 'Tablet', '250/200mg', 'Abbott Laboratories (Pakistan)', '012845',
 '["entamizole","metronidazole diloxanide","entamizol","entamizole tablet"]', 'Antiemetic / GI Tract', NOW()),

-- ============================================================================
-- Lipid-lowering Agent (4)
-- ============================================================================
('b0000001-0000-0000-0000-000000000033', 'Lipget', 'Simvastatin', 'Tablet', '20mg', 'Getz Pharma (Pvt.) Ltd.', '031485',
 '["lipget","simvastatin","simvastatin 20","lipget tablet"]', 'Lipid-lowering Agent', NOW()),

('b0000001-0000-0000-0000-000000000034', 'Crestor', 'Rosuvastatin', 'Tablet', '10mg', 'AstraZeneca Pharmaceuticals', '048291',
 '["crestor","rosuvastatin","rosuvastatine","crestor tablet"]', 'Lipid-lowering Agent', NOW()),

('b0000001-0000-0000-0000-000000000035', 'Rovista', 'Rosuvastatin', 'Tablet', '10mg', 'Getz Pharma (Pvt.) Ltd.', '051934',
 '["rovista","rosuvastatin","rovista tablet","rovista 10"]', 'Lipid-lowering Agent', NOW()),

('b0000001-0000-0000-0000-000000000036', 'Xplendid', 'Rosuvastatin', 'Tablet', '10mg', 'Sami Pharma', '052841',
 '["xplendid","rosuvastatin","xplendid tablet","xplendid 10"]', 'Lipid-lowering Agent', NOW()),

-- ============================================================================
-- Bronchodilator / Respiratory (4)
-- ============================================================================
('b0000001-0000-0000-0000-000000000037', 'Ventolin', 'Salbutamol', 'Inhaler', '100mcg', 'GSK Pakistan Limited', '003185',
 '["ventolin","salbutamol","albuterol","ventolinn","salbutmal"]', 'Bronchodilator / Respiratory', NOW()),

('b0000001-0000-0000-0000-000000000038', 'Symbicort', 'Budesonide/Formoterol', 'Inhaler', '160/4.5mcg', 'AstraZeneca Pharmaceuticals', '045812',
 '["symbicort","budesonide formoterol","symbicort inhaler","budesonide"]', 'Bronchodilator / Respiratory', NOW()),

('b0000001-0000-0000-0000-000000000039', 'Myteka', 'Montelukast', 'Tablet', '10mg', 'Hilton Pharma', '038145',
 '["myteka","montelukast","montelukast sodium","singulair","monelukast"]', 'Bronchodilator / Respiratory', NOW()),

('b0000001-0000-0000-0000-000000000040', 'Clenil', 'Beclomethasone', 'Inhaler', '250mcg', 'Chiesi Pharmaceuticals', '029481',
 '["clenil","beclomethasone","beclomethasone inhaler","clenil inhaler"]', 'Bronchodilator / Respiratory', NOW());
