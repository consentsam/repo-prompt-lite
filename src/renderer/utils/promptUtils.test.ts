import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFullPrompt, copyPromptToClipboard, MAX_TOKEN_LIMIT } from './promptUtils';
import { FileInfo } from '../types/common';

// Mock the window.api object
vi.mock('../../preload', () => ({
  api: {
    readFileContent: vi.fn(),
    writeToClipboard: vi.fn()
  }
}));

describe('promptUtils', () => {
  // Sample file data for testing
  const sampleFiles: FileInfo[] = [
    { 
      path: '/test/file1.txt', 
      relativePath: 'file1.txt', 
      size: 100, 
      isDirectory: false, 
      isSkipped: false, 
      tokenEstimate: 20 
    },
    { 
      path: '/test/file2.txt', 
      relativePath: 'file2.txt', 
      size: 200, 
      isDirectory: false, 
      isSkipped: false, 
      tokenEstimate: 30 
    },
    { 
      path: '/test/subdir', 
      relativePath: 'subdir', 
      size: 0, 
      isDirectory: true, 
      isSkipped: false, 
      tokenEstimate: 0 
    },
    { 
      path: '/test/binary.bin', 
      relativePath: 'binary.bin', 
      size: 1024 * 1024 * 2, 
      isDirectory: false, 
      isSkipped: true, 
      tokenEstimate: 0 
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateFullPrompt', () => {
    it('generates a prompt with file map and contents', async () => {
      // Mock readFileContent to return file contents
      window.api.readFileContent = vi.fn()
        .mockResolvedValueOnce({ content: 'Content of file1', isSkipped: false })
        .mockResolvedValueOnce({ content: 'Content of file2', isSkipped: false });

      const progressCallback = vi.fn();

      const result = await generateFullPrompt(
        sampleFiles,
        'test-repo',
        sampleFiles,
        {},
        progressCallback
      );

      // Verify the prompt contains both the file map and file contents
      expect(result.prompt).toContain('<file_map>');
      expect(result.prompt).toContain('</file_map>');
      expect(result.prompt).toContain('<file_contents path="file1.txt">');
      expect(result.prompt).toContain('Content of file1');
      expect(result.prompt).toContain('<file_contents path="file2.txt">');
      expect(result.prompt).toContain('Content of file2');

      // Verify readFileContent was called for non-directory, non-skipped files only
      expect(window.api.readFileContent).toHaveBeenCalledTimes(2);
      expect(window.api.readFileContent).toHaveBeenCalledWith('/test/file1.txt');
      expect(window.api.readFileContent).toHaveBeenCalledWith('/test/file2.txt');

      // Verify the progress callback was called
      expect(progressCallback).toHaveBeenCalledTimes(2);
      
      // Verify the stats are correct
      expect(result.tokensApprox).toBe(50); // Sum of token estimates
      expect(result.processedFiles).toBe(2);
      expect(result.totalFiles).toBe(2);
      expect(result.success).toBe(true);
    });

    it('handles files that cannot be read', async () => {
      // Mock readFileContent to return success for first file and error for second
      window.api.readFileContent = vi.fn()
        .mockResolvedValueOnce({ content: 'Content of file1', isSkipped: false })
        .mockResolvedValueOnce({ error: 'File not found', isSkipped: true });

      const result = await generateFullPrompt(sampleFiles.slice(0, 2), 'test-repo');

      // Verify the prompt contains the file that was successfully read
      expect(result.prompt).toContain('<file_contents path="file1.txt">');
      expect(result.prompt).toContain('Content of file1');
      
      // Verify an error is returned
      expect(result.success).toBe(false);
      expect(result.error).toContain('Error reading file2.txt');
    });

    it('enforces the token limit', async () => {
      // Create a file with a token estimate that exceeds the limit
      const largeFile: FileInfo = { 
        path: '/test/large.txt', 
        relativePath: 'large.txt', 
        size: 1000000, 
        isDirectory: false, 
        isSkipped: false, 
        tokenEstimate: MAX_TOKEN_LIMIT + 1000 
      };

      // Mock readFileContent to never be called (we'll hit the token limit check first)
      window.api.readFileContent = vi.fn();

      const result = await generateFullPrompt([largeFile], 'test-repo');

      // Verify the token limit was enforced
      expect(result.tokenCapExceeded).toBe(true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Token limit');
      
      // ReadFileContent should not be called because we hit the token limit
      expect(window.api.readFileContent).not.toHaveBeenCalled();
    });

    it('reports progress during file processing', async () => {
      // Mock readFileContent for multiple files
      window.api.readFileContent = vi.fn()
        .mockResolvedValueOnce({ content: 'Content 1', isSkipped: false })
        .mockResolvedValueOnce({ content: 'Content 2', isSkipped: false })
        .mockResolvedValueOnce({ content: 'Content 3', isSkipped: false });

      const progressCallback = vi.fn();
      const testFiles = [
        { path: '/test/1.txt', relativePath: '1.txt', size: 100, isDirectory: false, isSkipped: false, tokenEstimate: 10 },
        { path: '/test/2.txt', relativePath: '2.txt', size: 100, isDirectory: false, isSkipped: false, tokenEstimate: 10 },
        { path: '/test/3.txt', relativePath: '3.txt', size: 100, isDirectory: false, isSkipped: false, tokenEstimate: 10 }
      ];

      await generateFullPrompt(testFiles, 'test-repo', testFiles, {}, progressCallback);

      // Verify progress callback was called for each file
      expect(progressCallback).toHaveBeenCalledTimes(3);
      
      // Check first call
      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        current: 1,
        total: 3,
        fileName: '1.txt',
        percentage: 33 // rounded from 33.33...
      });
      
      // Check last call
      expect(progressCallback).toHaveBeenLastCalledWith({
        current: 3,
        total: 3,
        fileName: '3.txt',
        percentage: 100
      });
    });
  });

  describe('copyPromptToClipboard', () => {
    it('successfully copies prompt to clipboard', async () => {
      // Mock readFileContent
      window.api.readFileContent = vi.fn()
        .mockResolvedValueOnce({ content: 'Content of file1', isSkipped: false })
        .mockResolvedValueOnce({ content: 'Content of file2', isSkipped: false });
      
      // Mock writeToClipboard
      const writeToClipboardMock = vi.fn().mockResolvedValue({ success: true });
      window.api.writeToClipboard = writeToClipboardMock;

      const result = await copyPromptToClipboard(sampleFiles.slice(0, 2), 'test-repo');

      // Verify writeToClipboard was called with the generated prompt
      expect(writeToClipboardMock).toHaveBeenCalledTimes(1);
      
      // Get the first argument of the first call
      const clipboardArg = writeToClipboardMock.mock.calls[0][0];
      expect(clipboardArg).toContain('<file_map>');
      expect(clipboardArg).toContain('<file_contents path="file1.txt">');
      
      // Verify the result was successful
      expect(result.success).toBe(true);
      expect(result.tokensApprox).toBe(50);
      expect(result.processedFiles).toBe(2);
      expect(result.totalFiles).toBe(2);
    });

    it('handles clipboard write errors', async () => {
      // Mock readFileContent to succeed
      window.api.readFileContent = vi.fn()
        .mockResolvedValueOnce({ content: 'Content of file1', isSkipped: false });
      
      // Mock writeToClipboard to fail
      window.api.writeToClipboard = vi.fn().mockResolvedValue({ 
        success: false, 
        error: 'Clipboard access denied' 
      });

      const result = await copyPromptToClipboard([sampleFiles[0]], 'test-repo');

      // Verify the error is returned
      expect(result.success).toBe(false);
      expect(result.error).toBe('Clipboard access denied');
    });

    it('handles errors during prompt generation', async () => {
      // Mock readFileContent to throw an error
      window.api.readFileContent = vi.fn().mockRejectedValue(new Error('Read error'));

      const result = await copyPromptToClipboard([sampleFiles[0]], 'test-repo');

      // Verify the error is captured and returned
      expect(result.success).toBe(false);
      expect(result.error).toContain('Read error');
      
      // Verify writeToClipboard was not called
      expect(window.api.writeToClipboard).not.toHaveBeenCalled();
    });
    
    it('handles token limit exceeded during copy', async () => {
      // Create a file with a token estimate that exceeds the limit
      const largeFile: FileInfo = { 
        path: '/test/large.txt', 
        relativePath: 'large.txt', 
        size: 1000000, 
        isDirectory: false, 
        isSkipped: false, 
        tokenEstimate: MAX_TOKEN_LIMIT + 1000 
      };
      
      // Mock writeToClipboard to succeed (it should be called even with partial content)
      window.api.writeToClipboard = vi.fn().mockResolvedValue({ success: true });

      const result = await copyPromptToClipboard([largeFile], 'test-repo');

      // Verify the token limit exceeded flag is set
      expect(result.tokenCapExceeded).toBe(true);
      
      // The operation should still be considered successful
      expect(result.success).toBe(true);
      
      // Verify writeToClipboard was called
      expect(window.api.writeToClipboard).toHaveBeenCalledTimes(1);
    });
  });
}); 