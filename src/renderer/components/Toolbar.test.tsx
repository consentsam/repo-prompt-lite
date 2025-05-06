import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from './Toolbar';
import { FileInfo } from '../types/common';

describe('Toolbar Component', () => {
  // Mock props and functions
  const mockFiles: FileInfo[] = [
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
    }
  ];
  
  const mockProps = {
    selectedFiles: mockFiles,
    tokenLimit: 2000,
    warningThreshold: 80,
    onExpandAll: vi.fn(),
    onCollapseAll: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onTogglePreview: vi.fn(),
    onToggleStats: vi.fn(),
    showPreview: false,
    showStats: true,
    isCopying: false,
    onCopyToClipboard: vi.fn(),
    exceedsLimit: false
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders all buttons correctly', () => {
    render(<Toolbar {...mockProps} />);
    
    // Verify tree manipulation buttons
    expect(screen.getByText(/Expand/)).toBeInTheDocument();
    expect(screen.getByText(/Collapse/)).toBeInTheDocument();
    
    // Verify selection buttons
    expect(screen.getByText(/Select All/)).toBeInTheDocument();
    expect(screen.getByText(/Deselect All/)).toBeInTheDocument();
    
    // Verify view toggle buttons
    expect(screen.getByText(/Preview/)).toBeInTheDocument();
    expect(screen.getByText(/Stats/)).toBeInTheDocument();
    
    // Verify copy button
    expect(screen.getByText(/Copy to Clipboard/)).toBeInTheDocument();
  });
  
  it('displays token counter correctly', () => {
    render(<Toolbar {...mockProps} />);
    
    // Check token counter - 750 tokens out of 2000
    expect(screen.getByText(/750/)).toBeInTheDocument();
    expect(screen.getByText(/2,000/)).toBeInTheDocument();
  });
  
  it('triggers expand all when button is clicked', () => {
    render(<Toolbar {...mockProps} />);
    
    const expandButton = screen.getByText(/Expand/).closest('button');
    fireEvent.click(expandButton!);
    
    expect(mockProps.onExpandAll).toHaveBeenCalledTimes(1);
  });
  
  it('triggers collapse all when button is clicked', () => {
    render(<Toolbar {...mockProps} />);
    
    const collapseButton = screen.getByText(/Collapse/).closest('button');
    fireEvent.click(collapseButton!);
    
    expect(mockProps.onCollapseAll).toHaveBeenCalledTimes(1);
  });
  
  it('triggers select all when button is clicked', () => {
    render(<Toolbar {...mockProps} />);
    
    const selectAllButton = screen.getByText(/Select All/).closest('button');
    fireEvent.click(selectAllButton!);
    
    expect(mockProps.onSelectAll).toHaveBeenCalledTimes(1);
  });
  
  it('triggers deselect all when button is clicked', () => {
    render(<Toolbar {...mockProps} />);
    
    const deselectAllButton = screen.getByText(/Deselect All/).closest('button');
    fireEvent.click(deselectAllButton!);
    
    expect(mockProps.onDeselectAll).toHaveBeenCalledTimes(1);
  });
  
  it('toggles preview when button is clicked', () => {
    render(<Toolbar {...mockProps} />);
    
    const previewButton = screen.getByText(/Preview/).closest('button');
    fireEvent.click(previewButton!);
    
    expect(mockProps.onTogglePreview).toHaveBeenCalledTimes(1);
  });
  
  it('toggles stats when button is clicked', () => {
    render(<Toolbar {...mockProps} />);
    
    const statsButton = screen.getByText(/Stats/).closest('button');
    fireEvent.click(statsButton!);
    
    expect(mockProps.onToggleStats).toHaveBeenCalledTimes(1);
  });
  
  it('triggers copy to clipboard when button is clicked', () => {
    render(<Toolbar {...mockProps} />);
    
    const copyButton = screen.getByText(/Copy to Clipboard/).closest('button');
    fireEvent.click(copyButton!);
    
    expect(mockProps.onCopyToClipboard).toHaveBeenCalledTimes(1);
  });
  
  it('disables copy button when exceeding token limit', () => {
    const exceededProps = {
      ...mockProps,
      exceedsLimit: true
    };
    
    render(<Toolbar {...exceededProps} />);
    
    const copyButton = screen.getByText(/Copy to Clipboard/).closest('button');
    expect(copyButton).toHaveAttribute('disabled');
    
    // Try clicking the disabled button
    fireEvent.click(copyButton!);
    expect(mockProps.onCopyToClipboard).not.toHaveBeenCalled();
  });
  
  it('displays loading spinner when copying', () => {
    const copyingProps = {
      ...mockProps,
      isCopying: true
    };
    
    render(<Toolbar {...copyingProps} />);
    
    expect(screen.getByText(/Copying.../)).toBeInTheDocument();
    // Check for the spinner element
    expect(screen.getByText(/Copying.../).closest('span')?.querySelector('svg')).toBeInTheDocument();
  });
  
  it('applies active style to preview button when preview is shown', () => {
    const previewActiveProps = {
      ...mockProps,
      showPreview: true
    };
    
    const { container } = render(<Toolbar {...previewActiveProps} />);
    
    const previewButton = screen.getByText(/Preview/).closest('button');
    expect(previewButton).toHaveClass('bg-gray-600');
  });
  
  it('applies active style to stats button when stats are shown', () => {
    const statsActiveProps = {
      ...mockProps,
      showStats: true
    };
    
    const { container } = render(<Toolbar {...statsActiveProps} />);
    
    const statsButton = screen.getByText(/Stats/).closest('button');
    expect(statsButton).toHaveClass('bg-gray-600');
  });

  it('shows shortcut badges with each button', () => {
    render(<Toolbar {...mockProps} />);
    
    // Check for shortcut badges
    expect(screen.getByText('E')).toBeInTheDocument(); // Expand
    expect(screen.getByText('W')).toBeInTheDocument(); // Collapse
    expect(screen.getByText('Cmd+A')).toBeInTheDocument(); // Select All
    expect(screen.getByText('Cmd+D')).toBeInTheDocument(); // Deselect All
    expect(screen.getByText('P')).toBeInTheDocument(); // Preview
    expect(screen.getByText('S')).toBeInTheDocument(); // Stats
    expect(screen.getByText('Cmd+C')).toBeInTheDocument(); // Copy
  });
}); 