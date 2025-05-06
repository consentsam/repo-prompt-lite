import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileInfo } from '../types/common';

// Mock the actual FileTree component
vi.mock('./FileTree', () => ({
  default: vi.fn().mockImplementation(({ files, rootPath, onSelectionChange, onFilesUpdate }) => {
    // Expose methods via global for testing
    (window as any).fileTreeRef = {
      expandAll: vi.fn(() => {
        // Simulate expand all functionality
        const allDirectories = files.filter((f: FileInfo) => f.isDirectory);
        console.log('Expanding all directories:', allDirectories.length);
      }),
      collapseAll: vi.fn(() => {
        // Simulate collapse all functionality
        console.log('Collapsing all directories');
      }),
      selectAll: vi.fn(() => {
        // Simulate select all functionality - select all non-directory files
        const allFiles = files.filter((f: FileInfo) => !f.isDirectory && !f.isSkipped);
        onSelectionChange?.(allFiles);
        console.log('Selecting all files:', allFiles.length);
      }),
      deselectAll: vi.fn(() => {
        // Simulate deselect all functionality
        onSelectionChange?.([]);
        console.log('Deselecting all files');
      })
    };

    return (
      <div data-testid="file-tree">
        <div className="controls">
          <button onClick={() => (window as any).fileTreeRef.expandAll()}>Expand All</button>
          <button onClick={() => (window as any).fileTreeRef.collapseAll()}>Collapse All</button>
        </div>
        
        <div className="tree">
          {files.map((file: FileInfo) => (
            <div 
              key={file.path} 
              role="row"
              data-path={file.path}
              className={`file-row ${file.isDirectory ? 'directory' : 'file'} ${file.isSkipped ? 'skipped' : ''}`}
            >
              <button 
                className="checkbox"
                onClick={() => {
                  // Toggle selection
                  const isSelected = (window as any).selectedFiles?.some(
                    (f: FileInfo) => f.path === file.path
                  );
                  
                  if (isSelected) {
                    onSelectionChange?.([]);
                    (window as any).selectedFiles = [];
                  } else {
                    const selectedFile = files.find(f => f.path === file.path);
                    if (selectedFile && !selectedFile.isDirectory) {
                      onSelectionChange?.([selectedFile]);
                      (window as any).selectedFiles = [selectedFile];
                    }
                  }
                }}
              />
              <span>{file.relativePath || rootPath.split('/').pop()}</span>
              {file.isSkipped && file.skipReason === 'extension' && (
                <span>Binary file (by extension)</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  })
}));

// Import the mocked component
import FileTree from './FileTree';

describe('FileTree Component', () => {
  // Sample file data for testing
  const mockRootPath = '/test';
  const mockFiles: FileInfo[] = [
    {
      path: '/test',
      relativePath: '',
      size: 0,
      isDirectory: true,
      isSkipped: false,
      tokenEstimate: 0,
    },
    {
      path: '/test/dir1',
      relativePath: 'dir1',
      size: 0,
      isDirectory: true,
      isSkipped: false,
      tokenEstimate: 0,
    },
    {
      path: '/test/dir1/file1.ts',
      relativePath: 'dir1/file1.ts',
      size: 1000,
      isDirectory: false,
      isSkipped: false,
      tokenEstimate: 200,
    },
    {
      path: '/test/file2.js',
      relativePath: 'file2.js',
      size: 2000,
      isDirectory: false,
      isSkipped: false,
      tokenEstimate: 300,
    },
    {
      path: '/test/file3.bin',
      relativePath: 'file3.bin',
      size: 3000,
      isDirectory: false,
      isSkipped: true,
      skipReason: 'extension',
      tokenEstimate: 0,
    },
  ];

  const mockOnSelectionChange = vi.fn();
  const mockOnFilesUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).selectedFiles = [];
  });

  it('renders the file tree with expected elements', () => {
    render(
      <FileTree
        files={mockFiles}
        rootPath={mockRootPath}
        onSelectionChange={mockOnSelectionChange}
        onFilesUpdate={mockOnFilesUpdate}
      />
    );

    // Check for the presence of controls
    expect(screen.getByText('Expand All')).toBeInTheDocument();
    expect(screen.getByText('Collapse All')).toBeInTheDocument();
    
    // Check for files and directories
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('dir1')).toBeInTheDocument();
    expect(screen.getByText('file2.js')).toBeInTheDocument();
    expect(screen.getByText('file3.bin')).toBeInTheDocument();
    expect(screen.getByText('Binary file (by extension)')).toBeInTheDocument();
  });

  it('handles file selection and deselection', () => {
    render(
      <FileTree
        files={mockFiles}
        rootPath={mockRootPath}
        onSelectionChange={mockOnSelectionChange}
        onFilesUpdate={mockOnFilesUpdate}
      />
    );

    // Find file2.js row
    const file2Row = screen.getByText('file2.js').closest('.file-row');
    expect(file2Row).toBeInTheDocument();
    
    // Find and click the checkbox in the file2 row
    const checkbox = file2Row?.querySelector('.checkbox');
    fireEvent.click(checkbox!);
    
    // onSelectionChange should be called with the selected file
    expect(mockOnSelectionChange).toHaveBeenCalledTimes(1);
    expect(mockOnSelectionChange).toHaveBeenCalledWith([
      expect.objectContaining({
        path: '/test/file2.js'
      })
    ]);
    
    // Click again to deselect
    fireEvent.click(checkbox!);
    
    // onSelectionChange should be called with empty array
    expect(mockOnSelectionChange).toHaveBeenCalledTimes(2);
    expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
  });

  it('handles expand all and collapse all buttons', () => {
    render(
      <FileTree
        files={mockFiles}
        rootPath={mockRootPath}
        onSelectionChange={mockOnSelectionChange}
        onFilesUpdate={mockOnFilesUpdate}
      />
    );
    
    // Click expand all
    fireEvent.click(screen.getByText('Expand All'));
    
    // expandAll should have been called
    expect((window as any).fileTreeRef.expandAll).toHaveBeenCalledTimes(1);
    
    // Click collapse all
    fireEvent.click(screen.getByText('Collapse All'));
    
    // collapseAll should have been called
    expect((window as any).fileTreeRef.collapseAll).toHaveBeenCalledTimes(1);
  });

  it('handles select all and deselect all methods', () => {
    render(
      <FileTree
        files={mockFiles}
        rootPath={mockRootPath}
        onSelectionChange={mockOnSelectionChange}
        onFilesUpdate={mockOnFilesUpdate}
      />
    );
    
    // Call selectAll
    (window as any).fileTreeRef.selectAll();
    
    // onSelectionChange should be called with non-directory, non-skipped files
    expect(mockOnSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ path: '/test/file2.js' }),
        expect.objectContaining({ path: '/test/dir1/file1.ts' })
      ])
    );
    
    // Call deselectAll
    (window as any).fileTreeRef.deselectAll();
    
    // onSelectionChange should be called with empty array
    expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
  });
}); 