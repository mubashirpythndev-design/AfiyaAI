# Deployment Rules

- All cross-service URLs must come from environment variables.
- All credentials and API keys must come from environment variables.
- NEVER hardcode secrets.
- NEVER commit real `.env` secrets to the repository.
- Maintain an up-to-date `.env.example` file.
- The frontend must not expose server-side secrets.
- Production and development credentials must be separate.
- Deployment provider configuration must not leak into core business logic.
