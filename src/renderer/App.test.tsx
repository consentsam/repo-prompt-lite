import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Mock the required components to simplify testing
vi.mock('./components/FolderPicker', () => ({
  default: ({ onFolderSelected }: { onFolderSelected: (path: string) => void }) => (
    <div data-testid="folder-picker">
      <button onClick={() => onFolderSelected('/test/mock-folder')}>
        Select Folder
      </button>
    </div>
  )
}));

vi.mock('./components/DirectoryScanner', () => ({
  default: ({ folderPath, onScanComplete }: { folderPath: string; onScanComplete: (results: any) => void }) => {
    // Simulate scan completion when rendered
    setTimeout(() => {
      onScanComplete({
        rootPath: folderPath,
        files: [
          { path: `${folderPath}/file1.ts`, relativePath: 'file1.ts', size: 1000, isDirectory: false, isSkipped: false, tokenEstimate: 200 },
          { path: `${folderPath}/file2.js`, relativePath: 'file2.js', size: 2000, isDirectory: false, isSkipped: false, tokenEstimate: 300 },
          { path: `${folderPath}/dir1`, relativePath: 'dir1', size: 0, isDirectory: true, isSkipped: false, tokenEstimate: 0 }
        ],
        stats: {
          fileCount: 3,
          totalSize: 3000,
          totalTokens: 500
        }
      });
    }, 10);
    
    return <div data-testid="directory-scanner">Scanning: {folderPath}</div>;
  }
}));

vi.mock('./components/FileTree', () => ({
  default: vi.fn().mockImplementation(({ files, onSelectionChange, onFilesUpdate }) => {
    // Make the ref functions available via global variable for testing
    (window as any).fileTreeRef = {
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      selectAll: vi.fn(() => {
        onSelectionChange(files.filter((f: any) => !f.isDirectory));
      }),
      deselectAll: vi.fn(() => {
        onSelectionChange([]);
      })
    };
    
    return (
      <div data-testid="file-tree">
        <button onClick={() => onSelectionChange(files.filter((f: any) => !f.isDirectory))}>
          Select Files
        </button>
        <button onClick={() => onSelectionChange([])}>
          Clear Selection
        </button>
      </div>
    );
  })
}));

vi.mock('./components/Toolbar', () => ({
  default: ({ 
    onExpandAll, 
    onCollapseAll, 
    onSelectAll, 
    onDeselectAll,
    onTogglePreview,
    onToggleStats,
    onCopyToClipboard
  }: any) => (
    <div data-testid="toolbar">
      <button onClick={onExpandAll}>Expand All</button>
      <button onClick={onCollapseAll}>Collapse All</button>
      <button onClick={onSelectAll}>Select All</button>
      <button onClick={onDeselectAll}>Deselect All</button>
      <button onClick={onTogglePreview}>Toggle Preview</button>
      <button onClick={onToggleStats}>Toggle Stats</button>
      <button onClick={onCopyToClipboard}>Copy to Clipboard</button>
    </div>
  )
}));

vi.mock('./components/FileMapPreview', () => ({
  default: () => <div data-testid="file-map-preview">File Map Preview</div>
}));

vi.mock('./components/SelectionStats', () => ({
  default: () => <div data-testid="selection-stats">Selection Stats</div>
}));

// Mock clipboard functions
vi.mock('./utils/promptUtils', () => ({
  ...vi.importActual('./utils/promptUtils'),
  copyPromptToClipboard: vi.fn().mockImplementation(() => 
    Promise.resolve({ 
      success: true, 
      processedFiles: 2, 
      totalFiles: 2,
      tokensApprox: 500
    })
  ),
  DEFAULT_PROMPT_OPTIONS: {},
  MAX_TOKEN_LIMIT: 2000000
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders the initial state correctly', () => {
    render(<App />);
    
    // App title should be visible
    expect(screen.getByText(/Repo Prompt Lite/)).toBeInTheDocument();
    expect(screen.getByText(/Select a folder to generate code prompt/)).toBeInTheDocument();
    
    // FolderPicker should be rendered
    expect(screen.getByTestId('folder-picker')).toBeInTheDocument();
    
    // Other components should not be rendered yet
    expect(screen.queryByTestId('directory-scanner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('file-tree')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toolbar')).not.toBeInTheDocument();
  });
  
  it('shows directory scanner after folder selection', async () => {
    render(<App />);
    
    // Select a folder
    fireEvent.click(screen.getByText('Select Folder'));
    
    // DirectoryScanner should appear
    expect(screen.getByTestId('directory-scanner')).toBeInTheDocument();
    expect(screen.getByText(/Scanning: \/test\/mock-folder/)).toBeInTheDocument();
  });
  
  it('shows file tree after scan completion', async () => {
    render(<App />);
    
    // Select a folder
    fireEvent.click(screen.getByText('Select Folder'));
    
    // Wait for scan to complete
    await waitFor(() => {
      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    });
  });
  
  it('shows toolbar after file selection', async () => {
    render(<App />);
    
    // Select a folder
    fireEvent.click(screen.getByText('Select Folder'));
    
    // Wait for scan to complete and tree to appear
    await waitFor(() => {
      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    });
    
    // Select files
    fireEvent.click(screen.getByText('Select Files'));
    
    // Toolbar should appear
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });
  
  it('toggles preview panel', async () => {
    render(<App />);
    
    // Select a folder and wait for scan to complete
    fireEvent.click(screen.getByText('Select Folder'));
    await waitFor(() => expect(screen.getByTestId('file-tree')).toBeInTheDocument());
    
    // Select files to show toolbar
    fireEvent.click(screen.getByText('Select Files'));
    
    // Preview should not be visible yet
    expect(screen.queryByTestId('file-map-preview')).not.toBeInTheDocument();
    
    // Click toggle preview button
    fireEvent.click(screen.getByText('Toggle Preview'));
    
    // Preview should now be visible
    expect(screen.getByTestId('file-map-preview')).toBeInTheDocument();
    
    // Stats should be hidden
    expect(screen.queryByTestId('selection-stats')).not.toBeInTheDocument();
  });
  
  it('toggles stats panel', async () => {
    render(<App />);
    
    // Select a folder and wait for scan to complete
    fireEvent.click(screen.getByText('Select Folder'));
    await waitFor(() => expect(screen.getByTestId('file-tree')).toBeInTheDocument());
    
    // Select files to show toolbar
    fireEvent.click(screen.getByText('Select Files'));
    
    // Stats should be visible by default
    expect(screen.getByTestId('selection-stats')).toBeInTheDocument();
    
    // Click toggle stats button
    fireEvent.click(screen.getByText('Toggle Stats'));
    
    // Stats should now be hidden
    expect(screen.queryByTestId('selection-stats')).not.toBeInTheDocument();
  });
  
  it('triggers file tree methods from toolbar', async () => {
    render(<App />);
    
    // Select a folder and wait for scan to complete
    fireEvent.click(screen.getByText('Select Folder'));
    await waitFor(() => expect(screen.getByTestId('file-tree')).toBeInTheDocument());
    
    // Select files to show toolbar
    fireEvent.click(screen.getByText('Select Files'));
    
    // Click expand all
    fireEvent.click(screen.getByText('Expand All'));
    expect((window as any).fileTreeRef.expandAll).toHaveBeenCalledTimes(1);
    
    // Click collapse all
    fireEvent.click(screen.getByText('Collapse All'));
    expect((window as any).fileTreeRef.collapseAll).toHaveBeenCalledTimes(1);
    
    // Click select all
    fireEvent.click(screen.getByText('Select All'));
    expect((window as any).fileTreeRef.selectAll).toHaveBeenCalledTimes(1);
    
    // Click deselect all
    fireEvent.click(screen.getByText('Deselect All'));
    expect((window as any).fileTreeRef.deselectAll).toHaveBeenCalledTimes(1);
  });
  
  it('handles copy to clipboard action', async () => {
    const { copyPromptToClipboard } = await import('./utils/promptUtils');
    
    render(<App />);
    
    // Select a folder and wait for scan to complete
    fireEvent.click(screen.getByText('Select Folder'));
    await waitFor(() => expect(screen.getByTestId('file-tree')).toBeInTheDocument());
    
    // Select files to show toolbar
    fireEvent.click(screen.getByText('Select Files'));
    
    // Click copy to clipboard
    fireEvent.click(screen.getByText('Copy to Clipboard'));
    
    // Should call copyPromptToClipboard
    await waitFor(() => {
      expect(copyPromptToClipboard).toHaveBeenCalled();
    });
    
    // Success message should be displayed
    await waitFor(() => {
      expect(screen.getByText(/Successfully copied 2 files to clipboard/)).toBeInTheDocument();
    });
  });
  
  it('clears selection when selecting a new folder', async () => {
    render(<App />);
    
    // Select a folder and wait for scan to complete
    fireEvent.click(screen.getByText('Select Folder'));
    await waitFor(() => expect(screen.getByTestId('file-tree')).toBeInTheDocument());
    
    // Select files to show toolbar
    fireEvent.click(screen.getByText('Select Files'));
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    
    // Select a folder again (simulate selecting a different folder)
    fireEvent.click(screen.getByText('Select Folder'));
    
    // Toolbar should not be visible anymore since selection was cleared
    await waitFor(() => {
      expect(screen.queryByTestId('toolbar')).not.toBeInTheDocument();
    });
  });
}); 