# Automation entry point

This folder contains the daily product workflow, provider adapters, persisted job engine and example creative. The API and CLI share the same engine; n8n controls scheduling and calls one durable step per request.

## Run without credentials

From the monorepo root:

```bash
npm ci
cp .env.demo.example .env
npm run automation:run
```

This is a **fixture**, not a live AI-provider call: catalogue image, deterministic caption, `aiGenerated: false`, `status: dry_run`, no Instagram publish. Data persists in `.local/demo.json`. Repeat execution resumes the same daily draft instead of creating duplicates.

## Importable workflows

- `workflows/daily-instagram.json`: daily 09:00 Asia/Kolkata trigger and manual trigger, authenticated API steps, bounded wait loop, terminal error reporting.
- `workflows/expire-orders.json`: every 15 minutes, safely releases expired unpaid stock reservations.

Both import inactive. Configure API origins and your own HTTP Header Auth credential; no credentials are embedded. Docker setup is provided in `docker-compose.yml` and `.env.example`; select an n8n version and a stable encryption key before starting it. An imported JSON is not an active scheduled task.

## External integrations

Configure Gemini captions, a Gemini/Hugging Face image model, Cloudinary public hosting and your authorized Instagram account. Keep publishing disabled for a real draft first. The official Graph API adapter saves successful media IDs and flags ambiguous publish outcomes for manual review without auto-reposting.

See [the complete automation guide](../docs/AUTOMATION.md) for provider permissions, scheduling, modes and failure handling; [environment reference](../docs/ENVIRONMENT.md) for variables; and [verification results](../docs/TEST_RESULTS.md) for checks actually run. The `examples` folder contains a separately generated sample visual with provenance and limitations, not evidence of live Instagram publication.
