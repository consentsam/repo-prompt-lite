interface ScanProgressData {
  fileCount: number;
  totalSize: number;
  totalTokens: number;
  processing: string;
  error?: boolean;
  message?: string;
  done?: boolean;
}

interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  isDirectory: boolean;
  isSkipped: boolean;
  tokenEstimate: number;
}

interface ScanResults {
  rootPath: string;
  files: FileInfo[];
  stats: {
    fileCount: number;
    totalSize: number;
    totalTokens: number;
  };
}

interface FileContentResult {
  content: string;
  isSkipped: boolean;
  error?: string;
}

interface ClipboardResult {
  success: boolean;
  error?: string;
}

interface API {
  selectFolder: () => Promise<string | null>;
  verifyDroppedFolder: (path: string) => Promise<string | null>;
  walkDirectory: (path: string) => Promise<ScanResults>;
  readFileContent: (path: string) => Promise<FileContentResult>;
  writeToClipboard: (payload: string) => Promise<ClipboardResult>;
  onWalkProgress: (callback: (data: ScanProgressData) => void) => (() => void) | undefined;
}

declare global {
  interface Window {
    api: API;
  }
}

export {}; 