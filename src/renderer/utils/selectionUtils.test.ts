import { describe, it, expect } from 'vitest';
import { 
  getSelectedFiles, 
  getTotalTokenCount, 
  isExceedingTokenLimit, 
  getTokenUsagePercentage,
  formatFileSize,
  filterByExtension,
  groupByExtension,
  getFileStats
} from './selectionUtils';
import { FileInfo } from '../types/common';

describe('Selection Utilities', () => {
  // Sample test data
  const testFiles: FileInfo[] = [
    {
      path: '/test/file1.ts',
      relativePath: 'file1.ts',
      size: 1000,
      isDirectory: false,
      isSkipped: false,
      tokenEstimate: 250
    },
    {
      path: '/test/file2.js',
      relativePath: 'file2.js',
      size: 2000,
      isDirectory: false,
      isSkipped: false,
      tokenEstimate: 500
    },
    {
      path: '/test/dir1',
      relativePath: 'dir1',
      size: 0,
      isDirectory: true,
      isSkipped: false,
      tokenEstimate: 0
    },
    {
      path: '/test/binary.png',
      relativePath: 'binary.png',
      size: 5000,
      isDirectory: false,
      isSkipped: true,
      skipReason: 'extension',
      tokenEstimate: 0
    },
    {
      path: '/test/file3.ts',
      relativePath: 'file3.ts',
      size: 1500,
      isDirectory: false,
      isSkipped: false,
      tokenEstimate: 375
    }
  ];

  describe('getSelectedFiles', () => {
    it('filters out directories and skipped files', () => {
      const result = getSelectedFiles(testFiles);
      
      // Should only include non-directory and non-skipped files
      expect(result).toHaveLength(3);
      
      // Check that no directories are included
      expect(result.every(file => !file.isDirectory)).toBe(true);
      
      // Check that no skipped files are included
      expect(result.every(file => !file.isSkipped)).toBe(true);
      
      // Check that files are sorted by relative path
      expect(result[0].relativePath).toBe('file1.ts');
      expect(result[1].relativePath).toBe('file2.js');
      expect(result[2].relativePath).toBe('file3.ts');
    });
    
    it('returns an empty array for empty input', () => {
      expect(getSelectedFiles([])).toEqual([]);
    });
  });

  describe('getTotalTokenCount', () => {
    it('calculates the total token count correctly', () => {
      const validFiles = getSelectedFiles(testFiles);
      const totalTokens = getTotalTokenCount(validFiles);
      
      // 250 + 500 + 375 = 1125
      expect(totalTokens).toBe(1125);
    });
    
    it('returns 0 for empty input', () => {
      expect(getTotalTokenCount([])).toBe(0);
    });
  });

  describe('isExceedingTokenLimit', () => {
    it('returns false when tokens are below limit', () => {
      const validFiles = getSelectedFiles(testFiles);
      
      // Total tokens: 1125, Limit: 2000
      expect(isExceedingTokenLimit(validFiles, 2000)).toBe(false);
    });
    
    it('returns true when tokens exceed limit', () => {
      const validFiles = getSelectedFiles(testFiles);
      
      // Total tokens: 1125, Limit: 1000
      expect(isExceedingTokenLimit(validFiles, 1000)).toBe(true);
    });
    
    it('uses default limit of 2,000,000 when no limit provided', () => {
      const validFiles = getSelectedFiles(testFiles);
      
      // With default limit (2M), files shouldn't exceed
      expect(isExceedingTokenLimit(validFiles)).toBe(false);
    });
  });

  describe('getTokenUsagePercentage', () => {
    it('calculates percentage correctly', () => {
      const validFiles = getSelectedFiles(testFiles);
      
      // Total tokens: 1125, Limit: 2000 → 56.25%
      expect(getTokenUsagePercentage(validFiles, 2000)).toBe(56.25);
    });
    
    it('handles empty input', () => {
      expect(getTokenUsagePercentage([], 2000)).toBe(0);
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(512)).toBe('512 B');
    });
    
    it('formats kilobytes correctly', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
    
    it('formats megabytes correctly', () => {
      expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    });
    
    it('formats gigabytes correctly', () => {
      expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
    });
  });

  describe('filterByExtension', () => {
    it('filters files by extension correctly', () => {
      const validFiles = getSelectedFiles(testFiles);
      const tsFiles = filterByExtension(validFiles, 'ts');
      
      expect(tsFiles).toHaveLength(2);
      expect(tsFiles[0].relativePath).toBe('file1.ts');
      expect(tsFiles[1].relativePath).toBe('file3.ts');
    });
    
    it('handles extension with or without dot prefix', () => {
      const validFiles = getSelectedFiles(testFiles);
      const tsFiles1 = filterByExtension(validFiles, 'ts');
      const tsFiles2 = filterByExtension(validFiles, '.ts');
      
      expect(tsFiles1).toEqual(tsFiles2);
    });
  });

  describe('groupByExtension', () => {
    it('groups files by extension correctly', () => {
      const validFiles = getSelectedFiles(testFiles);
      const groups = groupByExtension(validFiles);
      
      expect(groups.size).toBe(2); // ts and js
      expect(groups.get('ts')?.length).toBe(2);
      expect(groups.get('js')?.length).toBe(1);
    });
  });

  describe('getFileStats', () => {
    it('calculates file statistics correctly', () => {
      const validFiles = getSelectedFiles(testFiles);
      const stats = getFileStats(validFiles);
      
      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSize).toBe(4500); // 1000 + 2000 + 1500
      expect(stats.totalTokens).toBe(1125); // 250 + 500 + 375
      
      // Check extension stats
      expect(stats.byExtension).toHaveLength(2); // ts and js
      
      // Check that extensions are sorted by count (ts has more files)
      expect(stats.byExtension[0].extension).toBe('ts');
      expect(stats.byExtension[0].count).toBe(2);
      
      expect(stats.byExtension[1].extension).toBe('js');
      expect(stats.byExtension[1].count).toBe(1);
    });
  });
}); 