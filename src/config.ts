import * as fs from 'fs';
import { AppConfig } from './types';

const CONFIG_PATH = process.env.CONFIG_PATH ?? '/app/config/config.json';

export function loadConfig(): AppConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found: ${CONFIG_PATH}`);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as AppConfig;
  if (!config.schedule) throw new Error('config.json: missing "schedule" field');
  if (!config.email?.recipients?.length) throw new Error('config.json: missing "email.recipients"');
  return config;
}

export function validateEnv(): void {
  const missing = ['SMTP_HOST', 'SMTP_PORT'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'borg-reports@localhost',
  };
}
