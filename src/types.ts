export interface AppConfig {
  schedule: string;
  email: {
    recipients: string[];
    repoRecipients?: Record<string, string[]>;
  };
}

export interface BorgArchive {
  name: string;
  timestamp: string;
  id: string;
}

export interface BorgStats {
  originalSize: string;
  compressedSize: string;
  deduplicatedSize: string;
  uniqueChunks: string;
  totalChunks: string;
}

export interface BorgRepoInfo {
  repositoryId: string;
  location: string;
  encrypted: string;
  stats: BorgStats;
}

export interface RepoReport {
  repoName: string;
  repoPath: string;
  info: BorgRepoInfo;
  archives: BorgArchive[];
  lastBackup: BorgArchive | null;
  error?: string;
}
