# borg-email-reports — Copilot Instructions

## Project overview
TypeScript Node.js batch application that monitors multiple BorgBackup repositories and sends HTML email reports via SMTP on a configurable cron schedule. Runs as a non-root Docker container (Alpine, user `app` UID 1001).

## Stack
- **Runtime**: Node.js 20, TypeScript (compiled to `dist/`)
- **Key deps**: `node-cron` (scheduling), `nodemailer` (SMTP), `dotenv` (env loading)
- **Container**: Alpine, multistage Dockerfile (`builder` → `dev` → `production`)

## Source layout
```
src/
  index.ts   — entry point: validates env, loads config, registers cron job
  config.ts  — loadConfig() reads /app/config/config.json; getSmtpConfig() reads env vars
  borg.ts    — inspectRepo(): reads passphrase, runs borg info/list, parses output
  email.ts   — sendEmail() wraps nodemailer, lazy-initialises the transporter
  report.ts  — buildEmailContent(): produces subject + HTML from a RepoReport
  types.ts   — shared interfaces (AppConfig, RepoReport, BorgRepoInfo, …)
```

## Key conventions
- All borg commands run via `execFileSync('borg', args)` — never interpolate paths into a shell string.
- Passphrase resolution order: `passphrase.sh` inside the repo folder (sourced via positional bash arg to prevent injection), then `BORG_PASSPHRASE__{folderName}` env var.
- `REPOS_BASE` defaults to `/home/app`; every non-hidden subdirectory is treated as a distinct Borg repo.
- Per-repo email recipients in `config.json` override (not append to) global recipients.
- Error reports are sent as HTML emails just like successful ones — never swallowed silently.

## Config files
- `config.json` (mounted read-only at `/app/config/config.json`): schedule + email recipients.
- `.env` (passed via `env_file` in compose): SMTP settings + Borg passphrases.

## Build & run
```bash
npm install          # install deps
npm run build        # tsc → dist/
npm start            # node dist/index.js

# Docker production
docker compose up -d --build

# Docker dev (ts-node, RUN_ON_STARTUP=true, src/ mounted)
docker compose -f docker-compose.dev.yml up --build
```

## Do not
- Do not add shell command string interpolation for paths — always use `execFileSync` with an args array.
- Do not send plaintext emails — all emails are HTML.
- Do not add per-repo cache or state files; the app is stateless between runs.
