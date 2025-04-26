/**
 * Common types used throughout the application
 */

// File information from the directory scan
export interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  isDirectory: boolean;
  isSkipped: boolean;
  tokenEstimate: number;
}

// Results from a directory scan
export interface ScanResults {
  rootPath: string;
  files: FileInfo[];
  stats: {
    fileCount: number;
    totalSize: number;
    totalTokens: number;
  };
}

// Checkbox states for the file tree
export type CheckState = 'unchecked' | 'checked' | 'indeterminate';

// Flattened file with additional properties for the tree view
export interface FlattenedFile extends FileInfo {
  id: string;
  level: number;
  isOpen?: boolean;
  children?: FlattenedFile[];
  parent?: FlattenedFile;
  visible: boolean;
  checkState: CheckState;
} 