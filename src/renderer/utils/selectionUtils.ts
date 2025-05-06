/**
 * Utilities for handling file selection and flattening
 */
import { FileInfo, FlattenedFile } from '../types/common';

/**
 * Gets all selected files from the selection
 * - Excludes directories (we only want actual files)
 * - Excludes skipped files (binary or too large)
 * - Sorts by relative path for consistent ordering
 */
export function getSelectedFiles(selectedFiles: FileInfo[]): FileInfo[] {
  // Filter out directories and skipped files
  const files = selectedFiles.filter(file => !file.isDirectory && !file.isSkipped);
  
  // Sort by relative path for consistent ordering
  return [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Flattens a directory structure based on selected nodes
 * This traverses a hierarchical file tree and returns a flat list of all selected files
 */
export function flattenSelection(rootNode: FlattenedFile, nodeStates: Map<string, string>): FileInfo[] {
  const selectedFiles: FileInfo[] = [];
  
  // Recursive function to traverse the tree
  const traverse = (node: FlattenedFile) => {
    const state = nodeStates.get(node.id);
    
    // If this is a file and it's checked, add it to the result
    if (!node.isDirectory && state === 'checked' && !node.isSkipped) {
      selectedFiles.push({
        path: node.path,
        relativePath: node.relativePath,
        size: node.size,
        isDirectory: node.isDirectory,
        isSkipped: node.isSkipped,
        tokenEstimate: node.tokenEstimate
      });
    }
    
    // Traverse children
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };
  
  // Start traversal from the root
  traverse(rootNode);
  
  // Sort by relative path
  return selectedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Filters a selection by file extension
 */
export function filterByExtension(files: FileInfo[], extension: string): FileInfo[] {
  const ext = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  return files.filter(file => file.relativePath.toLowerCase().endsWith(ext));
}

/**
 * Groups selected files by extension
 * Returns a map of extension -> files
 */
export function groupByExtension(files: FileInfo[]): Map<string, FileInfo[]> {
  const groups = new Map<string, FileInfo[]>();
  
  for (const file of files) {
    if (file.isDirectory) continue;
    
    const ext = file.relativePath.split('.').pop()?.toLowerCase() || 'unknown';
    
    if (!groups.has(ext)) {
      groups.set(ext, []);
    }
    
    groups.get(ext)?.push(file);
  }
  
  return groups;
}

/**
 * Gets file statistics grouped by type
 */
export function getFileStats(files: FileInfo[]): {
  totalFiles: number;
  totalSize: number;
  totalTokens: number;
  byExtension: { extension: string; count: number; size: number; tokens: number }[];
} {
  const groups = groupByExtension(files);
  const stats = {
    totalFiles: files.length,
    totalSize: files.reduce((sum, file) => sum + file.size, 0),
    totalTokens: files.reduce((sum, file) => sum + file.tokenEstimate, 0),
    byExtension: Array.from(groups.entries()).map(([ext, files]) => ({
      extension: ext,
      count: files.length,
      size: files.reduce((sum, file) => sum + file.size, 0),
      tokens: files.reduce((sum, file) => sum + file.tokenEstimate, 0)
    })).sort((a, b) => b.count - a.count)
  };
  
  return stats;
}

/**
 * Calculates the total token count for all selected files
 */
export function getTotalTokenCount(selectedFiles: FileInfo[]): number {
  return selectedFiles.reduce((sum, file) => sum + file.tokenEstimate, 0);
}

/**
 * Checks if the total token count exceeds the limit
 * Default limit is 2 million tokens (approximately 8MB of text)
 */
export function isExceedingTokenLimit(selectedFiles: FileInfo[], limit: number = 2000000): boolean {
  const totalTokens = getTotalTokenCount(selectedFiles);
  return totalTokens > limit;
}

/**
 * Gets the token usage as a percentage of the limit
 */
export function getTokenUsagePercentage(selectedFiles: FileInfo[], limit: number = 2000000): number {
  const totalTokens = getTotalTokenCount(selectedFiles);
  return (totalTokens / limit) * 100;
}

/**
 * Formats a number with commas for thousands
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Formats a file size in bytes to a human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
} 