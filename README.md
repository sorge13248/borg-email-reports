# borg-email-reports

Batch TypeScript/Node.js application that monitors multiple [BorgBackup](https://borgbackup.readthedocs.io/) repositories and sends formatted HTML email reports via SMTP on a configurable cron schedule.

Runs as a minimal, non-root Docker container (Alpine).

---

## Features

- Scans all subdirectories of `/home/app` — each is treated as a distinct Borg repo
- For each repo, runs `borg info` and `borg list` and sends an HTML email with:
  - Last backup date (highlighted)
  - Full archive list (newest first)
  - Repository statistics: original, compressed and deduplicated size
- Error reports are also sent via email — failures are never silent
- Per-repo email recipients override the global list
- Configurable cron schedule via `config.json`
- Passphrase read from `passphrase.sh` inside each repo folder, or from an env variable

---

## Quick start

### 1. Copy configuration files

```bash
cp .env.example .env
cp config.example.json config.json
```

### 2. Edit `.env`

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=borg@example.com
SMTP_PASS=secret
SMTP_FROM="Borg Reports <borg@example.com>"

# One entry per Borg repo (used if passphrase.sh is absent)
BORG_PASSPHRASE__my-repo=passphrase-here
```

### 3. Edit `config.json`

```json
{
  "schedule": "0 8 * * *",
  "email": {
    "recipients": ["admin@example.com"],
    "repoRecipients": {
      "my-repo": ["specific-person@example.com"]
    }
  }
}
```

`schedule` accepts any valid [cron expression](https://crontab.guru/).  
`repoRecipients` is optional — when set for a repo, it **replaces** (not appends to) the global recipients list.

### 4. Add Borg repo mounts to `docker-compose.yml`

```yaml
volumes:
  - ./config.json:/app/config/config.json:ro
  - /path/on/host/my-repo:/home/app/my-repo:ro
  - /path/on/host/other-repo:/home/app/other-repo:ro
```

### 5. Start

```bash
docker compose up -d --build
```

---

## Passphrase resolution

For each repo, passphrases are resolved in this order:

1. **`passphrase.sh`** — if a file with this name exists inside the repo folder, it is sourced and `$BORG_PASSPHRASE` is read from it:
   ```bash
   export BORG_PASSPHRASE='your-passphrase-here'
   ```
2. **Environment variable** — `BORG_PASSPHRASE__{FOLDER_NAME}` (e.g. `BORG_PASSPHRASE__my-repo`), set in `.env`.

If neither is found, the check fails and an error email is sent.

---

## Development

```bash
# With Docker (ts-node, live source mount, runs immediately on startup)
docker compose -f docker-compose.dev.yml up --build

# Without Docker
npm install
npm run build
RUN_ON_STARTUP=true node dist/index.js
```

Set `RUN_ON_STARTUP=true` in `.env` to trigger a check immediately on startup instead of waiting for the first cron tick.

---

## Project layout

```
src/
  index.ts    entry point — scheduler + per-repo check loop
  config.ts   config.json loader, SMTP config reader, env validator
  borg.ts     passphrase resolution, borg command execution, output parsers
  email.ts    nodemailer wrapper
  report.ts   HTML email builder (success + error templates)
  types.ts    shared TypeScript interfaces
Dockerfile          multistage: builder → dev → production
docker-compose.yml
docker-compose.dev.yml
config.example.json
.env.example
```

---

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `SMTP_HOST` | **yes** | — | SMTP server hostname |
| `SMTP_PORT` | **yes** | — | SMTP port (`587` STARTTLS, `465` TLS) |
| `SMTP_SECURE` | no | `false` | Set `true` for direct TLS (port 465) |
| `SMTP_USER` | no | — | SMTP auth username |
| `SMTP_PASS` | no | — | SMTP auth password |
| `SMTP_FROM` | no | `SMTP_USER` | Sender address |
| `BORG_PASSPHRASE__{name}` | per-repo | — | Repo passphrase fallback |
| `RUN_ON_STARTUP` | no | `false` | Run a check immediately on container start |
| `BORG_COMMAND_TIMEOUT_MS` | no | `300000` | Per-command timeout in ms |
| `REPOS_BASE` | no | `/home/app` | Root directory scanned for repos |
| `CONFIG_PATH` | no | `/app/config/config.json` | Path to `config.json` |

---

## CI/CD

A GitHub Actions workflow (`.github/workflows/docker-multiarch.yml`) builds and pushes a multi-architecture image (`linux/amd64`, `linux/arm64`) to GHCR on every push to `main` or on version tags (`v*`).

The image is published as: `ghcr.io/<owner>/<repo>:latest`
