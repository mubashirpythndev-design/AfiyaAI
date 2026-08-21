# Sources Schema

Schema definition for data provenance and pricing sources.

## Fields
- `id` (UUID): Primary Key
- `medicine_id` (UUID): Foreign key to the medicines table.
- `source_id` (String): Identifier from the original source if applicable.
- `source_url` (String, Optional): Link to the original source.
- `source_type` (String): e.g., "drap", "dawaai", "manual".
- `price` (Decimal, Optional): Price of the medicine from this source.
- `currency` (String, Optional): e.g., "PKR".
- `collected_at` (Timestamp): When this source record was collected.
