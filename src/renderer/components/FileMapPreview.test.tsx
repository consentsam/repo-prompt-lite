import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileMapPreview from './FileMapPreview';
import { FileInfo } from '../types/common';
import { TreeFormatOptions } from '../utils/formatUtils';

// Mock the formatUtils module
vi.mock('../utils/formatUtils', () => ({
  generateFileMap: vi.fn().mockReturnValue('mock-file-map-content'),
  TreeFormatOptions: {} as any
}));

describe('FileMapPreview Component', () => {
  // Sample file data for testing
  const mockFiles: FileInfo[] = [
    {
      path: '/test/file1.ts',
      relativePath: 'file1.ts',
      size: 1000,
      isDirectory: false,
      isSkipped: false,
      tokenEstimate: 200
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
      path: '/test/file2.js',
      relativePath: 'file2.js',
      size: 2000,
      isDirectory: false,
      isSkipped: false,
      tokenEstimate: 300
    }
  ];
  
  const defaultProps = {
    selectedFiles: mockFiles,
    rootFolderName: 'test-repo',
    allFiles: mockFiles,
    options: {} as TreeFormatOptions,
    onOptionsChange: vi.fn()
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders the preview with controls', () => {
    render(<FileMapPreview {...defaultProps} />);
    
    // Check heading
    expect(screen.getByText(/File Map Preview/)).toBeInTheDocument();
    
    // Check controls
    expect(screen.getByText(/Show file sizes/)).toBeInTheDocument();
    expect(screen.getByText(/Show token estimates/)).toBeInTheDocument();
    expect(screen.getByText(/Only show selected files/)).toBeInTheDocument();
    expect(screen.getByText(/Sort by/)).toBeInTheDocument();
    
    // Check preview content
    expect(screen.getByText(/mock-file-map-content/)).toBeInTheDocument();
  });
  
  it('toggles show sizes option', () => {
    render(<FileMapPreview {...defaultProps} />);
    
    const showSizesCheckbox = screen.getByLabelText(/Show file sizes/);
    
    // Initially off
    expect(showSizesCheckbox).not.toBeChecked();
    
    // Toggle on
    fireEvent.click(showSizesCheckbox);
    
    // Should call onOptionsChange with updated options
    expect(defaultProps.onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ showSizes: true })
    );
  });
  
  it('toggles show tokens option', () => {
    render(<FileMapPreview {...defaultProps} />);
    
    const showTokensCheckbox = screen.getByLabelText(/Show token estimates/);
    
    // Initially off
    expect(showTokensCheckbox).not.toBeChecked();
    
    // Toggle on
    fireEvent.click(showTokensCheckbox);
    
    // Should call onOptionsChange with updated options
    expect(defaultProps.onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ showTokens: true })
    );
  });
  
  it('toggles show only selected files option', () => {
    render(<FileMapPreview {...defaultProps} />);
    
    const showOnlySelectedCheckbox = screen.getByLabelText(/Only show selected files/);
    
    // Initially off
    expect(showOnlySelectedCheckbox).not.toBeChecked();
    
    // Toggle on
    fireEvent.click(showOnlySelectedCheckbox);
    
    // Should call onOptionsChange with updated options
    expect(defaultProps.onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ showOnlySelected: true })
    );
  });
  
  it('changes sort option', () => {
    render(<FileMapPreview {...defaultProps} />);
    
    const sortSelect = screen.getByLabelText(/Sort by/);
    
    // Change to 'size'
    fireEvent.change(sortSelect, { target: { value: 'size' } });
    
    // Should call onOptionsChange with updated options
    expect(defaultProps.onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'size' })
    );
  });
  
  it('changes sort direction', () => {
    render(<FileMapPreview {...defaultProps} />);
    
    // Find sort direction buttons
    const ascButton = screen.getByText('↑');
    const descButton = screen.getByText('↓');
    
    // Initially asc should be active
    expect(ascButton.parentElement).toHaveClass('bg-gray-700');
    expect(descButton.parentElement).not.toHaveClass('bg-gray-700');
    
    // Click desc button
    fireEvent.click(descButton);
    
    // Should call onOptionsChange with updated options
    expect(defaultProps.onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortDirection: 'desc' })
    );
  });
  
  it('changes max depth option', () => {
    render(<FileMapPreview {...defaultProps} />);
    
    const depthSelect = screen.getByLabelText(/Max depth/);
    
    // Change to depth 2
    fireEvent.change(depthSelect, { target: { value: '2' } });
    
    // Should call onOptionsChange with updated options
    expect(defaultProps.onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxDepth: 2 })
    );
  });
  
  it('handles undefined options gracefully', () => {
    const propsWithoutOptions = {
      ...defaultProps,
      options: undefined as unknown as TreeFormatOptions
    };
    
    // This should not throw
    render(<FileMapPreview {...propsWithoutOptions} />);
    
    // Basic assertions to ensure rendering
    expect(screen.getByText(/File Map Preview/)).toBeInTheDocument();
  });
}); 