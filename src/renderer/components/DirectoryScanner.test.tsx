import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DirectoryScanner from './DirectoryScanner';

// Mock the api object
vi.mock('../../preload', () => ({
  api: {
    walkDirectory: vi.fn(),
    onWalkProgress: vi.fn(),
    readFileContent: vi.fn(),
  }
}));

describe('DirectoryScanner', () => {
  const mockProps = {
    folderPath: '/test/folder',
    onScanComplete: vi.fn()
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders correctly with folder path', () => {
    render(<DirectoryScanner {...mockProps} />);
    
    expect(screen.getByText(/Directory Scan/)).toBeInTheDocument();
    expect(screen.getByText(/\/test\/folder/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Detect and skip binary files/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Skip files larger than 1 MB/)).toBeInTheDocument();
  });
  
  it('starts scan when folder path is provided', async () => {
    // Mock the walkDirectory function to return a promise
    const mockWalkDirectory = vi.fn().mockResolvedValue({
      files: [],
      rootPath: '/test/folder',
      stats: {
        fileCount: 0,
        totalSize: 0,
        totalTokens: 0
      }
    });
    
    // Replace the mocked implementation
    window.api.walkDirectory = mockWalkDirectory;
    
    render(<DirectoryScanner {...mockProps} />);
    
    // Check that walkDirectory was called with the correct parameters
    expect(mockWalkDirectory).toHaveBeenCalledWith(
      mockProps.folderPath,
      expect.objectContaining({
        binaryDetection: expect.any(Object)
      })
    );
    
    // Wait for the scan to complete
    await waitFor(() => {
      expect(mockProps.onScanComplete).toHaveBeenCalled();
    });
  });
  
  it('updates binary options when checkboxes are toggled', () => {
    render(<DirectoryScanner {...mockProps} />);
    
    // Find the checkboxes
    const skipBinaryCheckbox = screen.getByLabelText(/Detect and skip binary files/);
    const skipLargeCheckbox = screen.getByLabelText(/Skip files larger than 1 MB/);
    
    // Toggle skip binary checkbox
    fireEvent.click(skipBinaryCheckbox);
    
    // Toggle skip large checkbox
    fireEvent.click(skipLargeCheckbox);
    
    // Expect rescan button to appear
    expect(screen.getByText(/Rescan/)).toBeInTheDocument();
  });
  
  it('shows progress during scan', async () => {
    // Mock the progress event
    const progressCallback = vi.fn();
    window.api.onWalkProgress = vi.fn().mockImplementation((callback) => {
      progressCallback.mockImplementation(callback);
      return () => {}; // Return cleanup function
    });
    
    // Mock the walkDirectory function to return a promise
    const mockWalkDirectory = vi.fn().mockImplementation(() => {
      // Trigger progress event
      setTimeout(() => {
        progressCallback({
          fileCount: 10,
          totalSize: 1024,
          totalTokens: 5000,
          processing: 'file1.txt',
          skippedCount: 2,
          binaryCount: 1,
          sizeSkippedCount: 1
        });
      }, 10);
      
      return Promise.resolve({
        files: [],
        rootPath: '/test/folder',
        stats: {
          fileCount: 10,
          totalSize: 1024,
          totalTokens: 5000,
          skippedCount: 2,
          binaryCount: 1,
          sizeSkippedCount: 1
        }
      });
    });
    
    // Replace the mocked implementation
    window.api.walkDirectory = mockWalkDirectory;
    
    render(<DirectoryScanner {...mockProps} />);
    
    // Wait for the progress info to appear
    await waitFor(() => {
      expect(screen.getByText(/Processing: file1.txt/)).toBeInTheDocument();
      expect(screen.getByText(/10 files/)).toBeInTheDocument();
    });
  });
  
  it('handles scan errors correctly', async () => {
    // Mock the onWalkProgress to emit an error
    const progressCallback = vi.fn();
    window.api.onWalkProgress = vi.fn().mockImplementation((callback) => {
      progressCallback.mockImplementation(callback);
      return () => {}; // Return cleanup function
    });
    
    // Mock the walkDirectory function to throw an error
    const mockWalkDirectory = vi.fn().mockImplementation(() => {
      // Trigger error through progress event
      setTimeout(() => {
        progressCallback({
          error: true,
          message: 'Scan failed',
          fileCount: 0,
          totalSize: 0,
          totalTokens: 0,
          processing: ''
        });
      }, 10);
      
      return Promise.resolve({
        files: [],
        rootPath: '/test/folder',
        error: 'Scan failed',
        stats: {
          fileCount: 0,
          totalSize: 0,
          totalTokens: 0
        }
      });
    });
    
    // Replace the mocked implementation
    window.api.walkDirectory = mockWalkDirectory;
    
    render(<DirectoryScanner {...mockProps} />);
    
    // Wait for the error message to appear
    await waitFor(() => {
      expect(screen.getByText(/Scan failed/)).toBeInTheDocument();
    });
  });
  
  it('displays scan complete information when scan is successful', async () => {
    // Mock the walkDirectory function to return a successful result
    const mockWalkDirectory = vi.fn().mockResolvedValue({
      files: [
        { path: '/test/folder/file1.txt', relativePath: 'file1.txt', size: 100, isDirectory: false, isSkipped: false, tokenEstimate: 20 },
        { path: '/test/folder/file2.txt', relativePath: 'file2.txt', size: 200, isDirectory: false, isSkipped: false, tokenEstimate: 40 },
        { path: '/test/folder/binary.bin', relativePath: 'binary.bin', size: 300, isDirectory: false, isSkipped: true, tokenEstimate: 0 }
      ],
      rootPath: '/test/folder',
      stats: {
        fileCount: 3,
        totalSize: 600,
        totalTokens: 60,
        skippedCount: 1,
        binaryCount: 1,
        sizeSkippedCount: 0
      }
    });
    
    // Replace the mocked implementation
    window.api.walkDirectory = mockWalkDirectory;
    
    render(<DirectoryScanner {...mockProps} />);
    
    // Wait for the scan complete information to appear
    await waitFor(() => {
      expect(screen.getByText(/Scan Complete/)).toBeInTheDocument();
      expect(screen.getByText(/3/)).toBeInTheDocument(); // 3 files
      expect(screen.getByText(/600 B/)).toBeInTheDocument(); // 600 bytes
      expect(screen.getByText(/60/)).toBeInTheDocument(); // 60 tokens
      expect(screen.getByText(/1 files skipped/)).toBeInTheDocument();
    });
  });
}); 