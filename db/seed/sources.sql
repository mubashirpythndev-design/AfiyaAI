-- Afiya AI - Sources Seed Data
-- Provenance sources for medicine data

INSERT INTO sources (id, name, url, source_type) VALUES
    ('a0000001-0000-0000-0000-000000000001', 'DRAP Pakistan', 'https://www.dra.gov.pk/', 'drap'),
    ('a0000001-0000-0000-0000-000000000005', 'Manual Curation', NULL, 'manual'),
    ('a0000001-0000-0000-0000-000000000006', 'MedlinePlus', 'https://medlineplus.gov', 'reference'),
    ('a0000001-0000-0000-0000-000000000007', 'WHO Essential Medicines', 'https://www.who.int/tools/essential-medicines-list', 'reference');
