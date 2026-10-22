# Deployment readiness

Prescription attachments are stored privately in the API database, not the
Next.js deployment filesystem. Uploads go directly from the browser to FastAPI
to avoid the frontend function request-body limit. Stored `/uploads/{uuid}`
references stay compatible with existing orders. Admin previews read directly from the API; an authenticated Next.js GET
route proxies reads for compatibility; only the owner or a backend-authorized admin
may retrieve an attachment. Old local files are not automatically imported.

The additive `0013` migration creates `prescription_attachments` with an owner
foreign key, media type, byte size, binary data and creation timestamp. Images
are limited to 10 MiB, decoded and verified as JPEG/PNG/WebP before persistence.
No user filename is stored. Responses prohibit caching and content sniffing.
Database storage is a bounded MVP solution; retention, deletion and migration
to dedicated private object storage remain future operational work.

Release preparation must never load dotenv files. A process-environment-only
script previews database revision and schema differences by default. Explicit
flags apply migrations, synchronize reference data or seed labeled demo data.
No Git mutation, automatic deployment, payment integration or cloud resource
provisioning is included. Live changes require an available database connection.
