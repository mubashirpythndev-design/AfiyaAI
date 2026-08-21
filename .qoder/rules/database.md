# Database Rules

- Use migrations for schema changes.
- Implement proper constraints and foreign keys.
- Add indexes for performance where necessary.
- Store provenance data for records.
- Always use parameterized queries (no string concatenation for SQL).
- No destructive schema changes without review.
- Implement pgvector only after the embedding model decision is finalized.
