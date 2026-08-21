# Medicines Schema

Schema definition for structured medicine facts.

## Fields
- `id` (UUID): Primary Key
- `brand_name` (String): Name of the branded drug.
- `generic_name` (String): Active ingredient(s).
- `strength` (String): e.g., "500mg".
- `dosage_form` (String): e.g., "Tablet", "Syrup".
- `manufacturer` (String, Optional): Name of the manufacturer.
- `registration_info` (String, Optional): e.g., DRAP registration number.
- `aliases` (Array of Strings, Optional): Common misspellings or alternative names.
- `created_at` (Timestamp): When the record was created.
- `verified_at` (Timestamp, Optional): When the medicine identity was medically verified.

*(Note: Prices, package sizes, sources, and knowledge chunks are stored in separate authoritative tables to maintain strict provenance.)*
