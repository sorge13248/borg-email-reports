import { RepoReport } from './types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildErrorHtml(report: RepoReport): string {
  return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#333;max-width:800px;margin:auto;padding:20px">
  <h2 style="color:#c0392b;border-bottom:2px solid #c0392b;padding-bottom:8px">
    &#9888; Borg Backup Error: ${esc(report.repoName)}
  </h2>
  <p style="background:#fdecea;padding:14px;border-left:4px solid #c0392b;border-radius:4px;font-family:monospace;white-space:pre-wrap">${esc(report.error!)}</p>
  <p style="color:#888;font-size:12px">Path: ${esc(report.repoPath)}</p>
</body></html>`;
}

function buildRepoHtml(report: RepoReport): string {
  const { repoName, repoPath, info, archives, lastBackup } = report;

  const lastBadge = lastBackup
    ? `<span style="background:#27ae60;color:#fff;padding:5px 12px;border-radius:4px;font-weight:bold;font-size:15px">${esc(lastBackup.timestamp)}</span>
       <span style="color:#888;margin-left:10px;font-size:13px">${esc(lastBackup.name)}</span>`
    : `<span style="background:#e74c3c;color:#fff;padding:5px 12px;border-radius:4px">No archives found</span>`;

  const archiveRows = [...archives]
    .reverse()
    .map(
      (a, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#fff'}">
      <td style="padding:7px 12px;font-family:monospace;font-size:13px">${esc(a.name)}</td>
      <td style="padding:7px 12px;font-size:13px">${esc(a.timestamp)}</td>
      <td style="padding:7px 12px;font-family:monospace;font-size:11px;color:#aaa">${esc(a.id.substring(0, 16))}&hellip;</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#333;max-width:900px;margin:auto;padding:20px">
  <h2 style="color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:8px">
    &#128196; Borg Backup Report &mdash; <code>${esc(repoName)}</code>
  </h2>
  <p style="color:#888;font-size:12px">Generated: ${new Date().toISOString()}</p>

  <h3 style="color:#2980b9;margin-top:24px">&#128197; Last backup</h3>
  <p style="margin:4px 0">${lastBadge}</p>

  <h3 style="color:#2980b9;margin-top:24px">&#128202; Repository statistics</h3>
  <table style="border-collapse:collapse;width:100%;max-width:500px">
    <tr style="background:#3498db;color:#fff">
      <th style="padding:8px 14px;text-align:left">Metric</th>
      <th style="padding:8px 14px;text-align:right">Value</th>
    </tr>
    <tr style="background:#f9f9f9">
      <td style="padding:8px 14px">Original size</td>
      <td style="padding:8px 14px;text-align:right;font-weight:bold">${esc(info.stats.originalSize)}</td>
    </tr>
    <tr>
      <td style="padding:8px 14px">Compressed size</td>
      <td style="padding:8px 14px;text-align:right">${esc(info.stats.compressedSize)}</td>
    </tr>
    <tr style="background:#f9f9f9">
      <td style="padding:8px 14px">Deduplicated size</td>
      <td style="padding:8px 14px;text-align:right;color:#27ae60;font-weight:bold">${esc(info.stats.deduplicatedSize)}</td>
    </tr>
    <tr>
      <td style="padding:8px 14px">Unique chunks</td>
      <td style="padding:8px 14px;text-align:right">${esc(info.stats.uniqueChunks)}</td>
    </tr>
    <tr style="background:#f9f9f9">
      <td style="padding:8px 14px">Total chunks</td>
      <td style="padding:8px 14px;text-align:right">${esc(info.stats.totalChunks)}</td>
    </tr>
  </table>

  <h3 style="color:#2980b9;margin-top:28px">&#128230; Archives (${archives.length} total)</h3>
  <table style="border-collapse:collapse;width:100%">
    <tr style="background:#3498db;color:#fff">
      <th style="padding:8px 14px;text-align:left">Archive name</th>
      <th style="padding:8px 14px;text-align:left">Date</th>
      <th style="padding:8px 14px;text-align:left">ID (partial)</th>
    </tr>
    ${archiveRows}
  </table>

  <p style="color:#aaa;font-size:11px;margin-top:20px;border-top:1px solid #eee;padding-top:10px">
    Repository: <code>${esc(repoName)}</code> &bull;
    Location: <code>${esc(info.location || repoPath)}</code> &bull;
    Encrypted: ${esc(info.encrypted)}
  </p>
</body></html>`;
}

export function buildEmailContent(report: RepoReport): { subject: string; html: string } {
  if (report.error) {
    return {
      subject: `[Borg] ERROR - ${report.repoName}`,
      html: buildErrorHtml(report),
    };
  }
  const last = report.lastBackup ? report.lastBackup.timestamp : 'never';
  return {
    subject: `[Borg] Report: ${report.repoName} | Last: ${last} | Archives: ${report.archives.length}`,
    html: buildRepoHtml(report),
  };
}
