// SPDX-License-Identifier: AGPL-3.0-only
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import cron from 'node-cron';
import { loadConfig, validateEnv } from './config';
import { inspectRepo } from './borg';
import { buildEmailContent } from './report';
import { sendEmail } from './email';
import { RepoReport } from './types';

const REPOS_BASE = process.env.REPOS_BASE ?? '/home/app';

async function scanRepos(): Promise<string[]> {
  const entries = await fs.promises.readdir(REPOS_BASE, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

async function runChecks(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Starting Borg checks...`);
  const config = loadConfig();
  const repos = await scanRepos();

  if (repos.length === 0) {
    console.warn(`No repositories found in ${REPOS_BASE}`);
    return;
  }

  for (const repoName of repos) {
    const repoPath = path.join(REPOS_BASE, repoName);
    let report: RepoReport;

    try {
      const { info, archives } = inspectRepo(repoPath, repoName);
      report = {
        repoName,
        repoPath,
        info,
        archives,
        lastBackup: archives.length > 0 ? archives[archives.length - 1] : null,
      };
      console.log(`  [OK] ${repoName}: ${archives.length} archives, last: ${report.lastBackup?.timestamp ?? 'none'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [ERR] ${repoName}: ${message}`);
      // cast satisfies TS but info fields are unused in error reports
      report = {
        repoName,
        repoPath,
        info: {} as RepoReport['info'],
        archives: [],
        lastBackup: null,
        error: message,
      };
    }

    const recipients = config.email.repoRecipients?.[repoName] ?? config.email.recipients;
    const { subject, html } = buildEmailContent(report);

    try {
      await sendEmail(recipients, subject, html);
      console.log(`  [MAIL] Sent to: ${recipients.join(', ')}`);
    } catch (err) {
      console.error(`  [MAIL ERR] Failed to send for ${repoName}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[${new Date().toISOString()}] Checks complete.`);
}

function main(): void {
  validateEnv();
  const config = loadConfig();

  if (!cron.validate(config.schedule)) {
    throw new Error(`Invalid cron expression: "${config.schedule}"`);
  }

  console.log(`Borg Email Reports started. Schedule: ${config.schedule}`);

  cron.schedule(config.schedule, () => {
    runChecks().catch((err) =>
      console.error('Check run failed:', err instanceof Error ? err.message : err)
    );
  });

  if (process.env.RUN_ON_STARTUP === 'true') {
    runChecks().catch((err) =>
      console.error('Startup run failed:', err instanceof Error ? err.message : err)
    );
  }
}

main();
