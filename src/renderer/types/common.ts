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
  skipReason?: string;
  tokenEstimate: number;
  hasChildren?: boolean;
  childrenLoaded?: boolean;
  hasLazyChildren?: boolean;
}

// Results from a directory scan
export interface ScanResults {
  rootPath: string;
  files: FileInfo[];
  stats: {
    fileCount: number;
    totalSize: number;
    totalTokens: number;
    skippedCount?: number;
    binaryCount?: number;
    sizeSkippedCount?: number;
  };
}

// Checkbox states for the file tree
export type CheckState = 'checked' | 'unchecked' | 'indeterminate';

// Flattened file with additional properties for the tree view
export interface FlattenedFile {
  id: string;
  parentId: string | null;
  path: string;
  relativePath: string;
  name: string;
  level: number;
  isDirectory: boolean;
  isExpanded?: boolean;
  isSkipped: boolean;
  skipReason?: string;
  size: number;
  tokenEstimate: number;
  hasLazyChildren?: boolean;
  checkState?: CheckState;
}

// Binary detection options
export interface BinaryDetectionOptions {
  maxSizeBytes?: number;       // Maximum file size (default: 1MB)
  checkContent?: boolean;      // Whether to check file content (default: true)
  checkExtension?: boolean;    // Whether to check file extension (default: true)
  sampleSize?: number;         // Bytes to sample for content check (default: 512)
  binaryThreshold?: number;    // Binary threshold percentage (default: 10%)
}

// Result of a binary file check
export interface BinaryCheckResult {
  isBinary: boolean;
  reason?: 'extension' | 'size' | 'content' | 'error';
  details?: string;
} 