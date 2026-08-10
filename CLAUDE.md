# CLAUDE.md

## Project
TypeScript Node.js batch app — monitors BorgBackup repositories and sends HTML email reports on a cron schedule. Runs inside Docker (Alpine, non-root user `app`, UID 1001).

## Build & run commands
```bash
npm install
npm run build          # tsc → dist/
npm start              # node dist/index.js

docker compose up -d --build                          # produzione
docker compose -f docker-compose.dev.yml up --build   # sviluppo (ts-node)
```

## Architecture
```
src/index.ts    entry point — validateEnv → loadConfig → cron.schedule
src/config.ts   loadConfig() (config.json), validateEnv(), getSmtpConfig()
src/borg.ts     inspectRepo(repoPath, repoName) → { info, archives }
src/email.ts    sendEmail(to[], subject, html)
src/report.ts   buildEmailContent(report) → { subject, html }
src/types.ts    AppConfig, RepoReport, BorgRepoInfo, BorgArchive, BorgStats
```

## Critical invariants
- Borg commands use `execFileSync('borg', argsArray)` — paths are never interpolated into shell strings.
- Passphrase lookup: `passphrase.sh` in the repo folder first (sourced via `bash -c '. "$1" ...' -- path`), then `BORG_PASSPHRASE__{folderName}` env var.
- `REPOS_BASE` (default `/home/app`) is scanned at each run; all non-hidden subdirectories are Borg repos.
- `config.email.repoRecipients[name]` overrides (replaces) global `recipients` — it does not merge.
- All emails are HTML. Errors also produce an HTML email, never a silent failure.

## Environment variables (from .env)
| Variable | Required | Description |
|---|---|---|
| `SMTP_HOST` | yes | SMTP server hostname |
| `SMTP_PORT` | yes | SMTP port (587 / 465) |
| `SMTP_SECURE` | no | `true` for direct TLS (465) |
| `SMTP_USER` | no | SMTP auth username |
| `SMTP_PASS` | no | SMTP auth password |
| `SMTP_FROM` | no | From address |
| `BORG_PASSPHRASE__{name}` | per-repo | Fallback passphrase when passphrase.sh absent |
| `RUN_ON_STARTUP` | no | `true` to trigger an immediate run |
| `BORG_COMMAND_TIMEOUT_MS` | no | Timeout per borg command (default 300000) |
| `REPOS_BASE` | no | Override repo scan root (default `/home/app`) |
| `CONFIG_PATH` | no | Override config.json path (default `/app/config/config.json`) |

## config.json schema
```json
{
  "schedule": "0 8 * * *",
  "email": {
    "recipients": ["admin@example.com"],
    "repoRecipients": {
      "repo-name": ["specific@example.com"]
    }
  }
}
```
