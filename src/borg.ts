import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { BorgArchive, BorgRepoInfo, BorgStats } from './types';

const BORG_TIMEOUT = parseInt(process.env.BORG_COMMAND_TIMEOUT_MS ?? '300000', 10);

function getPassphrase(repoPath: string, repoName: string): string {
  const scriptPath = path.join(repoPath, 'passphrase.sh');

  let scriptReadable = false;
  try {
    fs.accessSync(scriptPath, fs.constants.R_OK);
    scriptReadable = true;
  } catch {
    // Log a warning if the file exists but isn't readable, then fall through to env var
    try {
      fs.accessSync(scriptPath, fs.constants.F_OK);
      console.warn(
        `  [WARN] passphrase.sh found at ${scriptPath} but not readable (UID ${process.getuid?.() ?? '?'}). ` +
        `Falling back to env var.`
      );
    } catch {
      // ENOENT or similar — file genuinely absent, fall through silently
    }
  }

  if (scriptReadable) {
    try {
      // Positional param avoids shell injection: $1 is the script path, never interpolated
      const result = execFileSync(
        'bash',
        ['-c', '. "$1" && printf "%s" "$BORG_PASSPHRASE"', 'passphrase-reader', scriptPath],
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      if (result) return result;
      throw new Error(
        `passphrase.sh found at ${scriptPath} but BORG_PASSPHRASE is empty after sourcing`
      );
    } catch (err) {
      throw new Error(
        `Failed to read passphrase from ${scriptPath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const envKey = `BORG_PASSPHRASE__${repoName}`;
  const passphrase = process.env[envKey];
  if (passphrase) return passphrase;
  throw new Error(
    `No passphrase found for repo "${repoName}".\n` +
    `  • passphrase.sh not found at: ${scriptPath}\n` +
    `  • env var not set: ${envKey}`
  );
}

function borgRun(args: string[], passphrase: string): string {
  // No cwd override — avoids EACCES when the repo directory is not traversable by the container user
  try {
    return execFileSync('borg', args, {
      encoding: 'utf8',
      timeout: BORG_TIMEOUT,
      env: {
        ...process.env,
        BORG_PASSPHRASE: passphrase,
        BORG_RELOCATED_REPO_ACCESS_IS_OK: 'yes',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('PermissionError') || msg.includes('Permission denied') || msg.includes('EACCES')) {
      throw new Error(
        `Borg: permission denied on ${args[args.length - 1]}.\n` +
        `  The container user does not have read access to the repo directory.`
      );
    }
    throw err;
  }
}

function parseInfo(output: string): BorgRepoInfo {
  const field = (key: string) =>
    output.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';

  const statsMatch = output.match(
    /All archives:\s+([\d.]+ \S+)\s+([\d.]+ \S+)\s+([\d.]+ \S+)/
  );
  const chunksMatch = output.match(/Chunk index:\s+(\d+)\s+(\d+)/);

  const stats: BorgStats = {
    originalSize: statsMatch?.[1] ?? 'N/A',
    compressedSize: statsMatch?.[2] ?? 'N/A',
    deduplicatedSize: statsMatch?.[3] ?? 'N/A',
    uniqueChunks: chunksMatch?.[1] ?? 'N/A',
    totalChunks: chunksMatch?.[2] ?? 'N/A',
  };

  return {
    repositoryId: field('Repository ID'),
    location: field('Location'),
    encrypted: field('Encrypted'),
    stats,
  };
}

function parseList(output: string): BorgArchive[] {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .reduce<BorgArchive[]>((acc, line) => {
      const m = line.match(/^(\S+)\s+(.+?)\s+\[([a-f0-9]+)\]$/);
      if (m) acc.push({ name: m[1], timestamp: m[2].trim(), id: m[3] });
      return acc;
    }, []);
}

export function inspectRepo(
  repoPath: string,
  repoName: string
): { info: BorgRepoInfo; archives: BorgArchive[] } {
  const passphrase = getPassphrase(repoPath, repoName);
  const infoOutput = borgRun(['info', repoPath], passphrase);
  const listOutput = borgRun(['list', repoPath], passphrase);
  return {
    info: parseInfo(infoOutput),
    archives: parseList(listOutput),
  };
}
