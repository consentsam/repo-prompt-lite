/**
 * Utilities for handling file selection and flattening
 */
import { FileInfo } from '../types/common';

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