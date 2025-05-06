import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TokenCounter from './TokenCounter';
import { FileInfo } from '../types/common';

describe('TokenCounter Component', () => {
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
      path: '/test/file2.ts',
      relativePath: 'file2.ts',
      size: 2000,
      isDirectory: false,
      isSkipped: false,
      tokenEstimate: 300
    }
  ];

  it('renders with the correct token count', () => {
    render(
      <TokenCounter 
        selectedFiles={mockFiles} 
        tokenLimit={2000} 
        warningThreshold={80} 
      />
    );

    // Check if the component displays the correct token count (500)
    expect(screen.getByText('500 / 2,000 tokens')).toBeInTheDocument();
  });

  it('applies warning styling when approaching token limit', () => {
    // Create files with token counts near the warning threshold
    const warningFiles: FileInfo[] = [
      {
        path: '/test/file1.ts',
        relativePath: 'file1.ts',
        size: 1000,
        isDirectory: false,
        isSkipped: false,
        tokenEstimate: 1600 // 80% of limit
      }
    ];

    const { container } = render(
      <TokenCounter 
        selectedFiles={warningFiles} 
        tokenLimit={2000} 
        warningThreshold={80} 
      />
    );

    // Check for warning styling
    const tokenCounter = container.querySelector('.token-counter');
    expect(tokenCounter).toHaveClass('bg-yellow-900/40');
    expect(tokenCounter).toHaveClass('text-yellow-300');
  });

  it('applies error styling when exceeding token limit', () => {
    // Create files with token counts exceeding the limit
    const errorFiles: FileInfo[] = [
      {
        path: '/test/file1.ts',
        relativePath: 'file1.ts',
        size: 1000,
        isDirectory: false,
        isSkipped: false,
        tokenEstimate: 2100 // > 100% of limit
      }
    ];

    const { container } = render(
      <TokenCounter 
        selectedFiles={errorFiles} 
        tokenLimit={2000} 
        warningThreshold={80} 
      />
    );

    // Check for error styling
    const tokenCounter = container.querySelector('.token-counter');
    expect(tokenCounter).toHaveClass('bg-red-900/40');
    expect(tokenCounter).toHaveClass('text-red-300');
  });

  it('handles empty file selection', () => {
    render(
      <TokenCounter 
        selectedFiles={[]} 
        tokenLimit={2000} 
        warningThreshold={80} 
      />
    );

    // Check if the component displays zero tokens
    expect(screen.getByText('0 / 2,000 tokens')).toBeInTheDocument();
  });
}); 