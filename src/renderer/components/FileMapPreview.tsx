import React, { useState, useEffect } from 'react';
import { FileInfo } from '../types/common';
import { generateFileMap, TreeFormatOptions } from '../utils/formatUtils';
import clsx from 'clsx';

interface FileMapPreviewProps {
  selectedFiles: FileInfo[];
  rootFolderName?: string;
  allFiles?: FileInfo[];
  options?: TreeFormatOptions;
  onOptionsChange?: (options: TreeFormatOptions) => void;
}

/**
 * Component to preview the file map that will be generated
 */
export default function FileMapPreview({ 
  selectedFiles, 
  rootFolderName, 
  allFiles,
  options: externalOptions,
  onOptionsChange
}: FileMapPreviewProps): JSX.Element {
  // State for tree formatting options
  const [options, setOptions] = useState<TreeFormatOptions>({
    showSizes: false,
    showTokens: false,
    showBinary: true,
    highlightSelected: true,
    sortDirectoriesFirst: true,
    sortBy: 'name',
    sortDirection: 'asc',
    showOnlySelected: false,
    maxDepth: undefined
  });
  
  // Initialize local options from external options if provided
  useEffect(() => {
    if (externalOptions) {
      setOptions(externalOptions);
    }
  }, [externalOptions]);
  
  // Toggle a boolean option
  const toggleOption = (option: keyof TreeFormatOptions) => {
    const newOptions = {
      ...options,
      [option]: typeof options[option] === 'boolean' ? !options[option] : options[option]
    };
    setOptions(newOptions);
    
    // Notify parent component if callback is provided
    if (onOptionsChange) {
      onOptionsChange(newOptions);
    }
  };
  
  // Set a non-boolean option
  const setOption = (option: keyof TreeFormatOptions, value: any) => {
    const newOptions = {
      ...options,
      [option]: value
    };
    setOptions(newOptions);
    
    // Notify parent component if callback is provided
    if (onOptionsChange) {
      onOptionsChange(newOptions);
    }
  };
  
  // Generate the file map with current options
  const fileMap = generateFileMap(selectedFiles, rootFolderName, allFiles, options);
  
  // Split into lines for rendering
  const lines = fileMap.split('\n');
  
  // Calculate some stats for the preview header
  const totalFiles = selectedFiles.filter(f => !f.isDirectory).length;
  const shownFiles = options.showOnlySelected 
    ? selectedFiles.filter(f => !f.isDirectory).length
    : allFiles?.filter(f => !f.isDirectory).length || 0;
  
  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium text-gray-200">File Map Preview</h3>
        <div className="text-sm text-gray-400">
          {totalFiles} selected / {shownFiles} total files
        </div>
      </div>
      
      <div className="mb-4 bg-gray-800 rounded-lg p-3 flex flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-300">View:</label>
          <select
            className="bg-gray-700 text-gray-300 text-sm rounded px-2 py-1 border border-gray-600"
            value={options.showOnlySelected ? 'selected' : 'all'}
            onChange={(e) => setOption('showOnlySelected', e.target.value === 'selected')}
          >
            <option value="all">All Files</option>
            <option value="selected">Selected Only</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-300">Sort By:</label>
          <select
            className="bg-gray-700 text-gray-300 text-sm rounded px-2 py-1 border border-gray-600"
            value={options.sortBy}
            onChange={(e) => setOption('sortBy', e.target.value)}
          >
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="tokens">Tokens</option>
          </select>
          
          <button
            className="p-1 rounded hover:bg-gray-600"
            title={options.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            onClick={() => setOption('sortDirection', options.sortDirection === 'asc' ? 'desc' : 'asc')}
          >
            {options.sortDirection === 'asc' ? (
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
            )}
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-300">Max Depth:</label>
          <select
            className="bg-gray-700 text-gray-300 text-sm rounded px-2 py-1 border border-gray-600"
            value={options.maxDepth?.toString() || 'unlimited'}
            onChange={(e) => setOption('maxDepth', e.target.value === 'unlimited' ? undefined : parseInt(e.target.value))}
          >
            <option value="unlimited">Unlimited</option>
            <option value="1">1 (Root only)</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-3">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
              checked={!!options.showSizes}
              onChange={() => toggleOption('showSizes')}
            />
            <span className="ml-2 text-sm text-gray-300">Show Sizes</span>
          </label>
          
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
              checked={!!options.showTokens}
              onChange={() => toggleOption('showTokens')}
            />
            <span className="ml-2 text-sm text-gray-300">Show Tokens</span>
          </label>
          
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
              checked={!!options.sortDirectoriesFirst}
              onChange={() => toggleOption('sortDirectoriesFirst')}
            />
            <span className="ml-2 text-sm text-gray-300">Dirs First</span>
          </label>
        </div>
      </div>
      
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-auto">
        <pre className="p-4 text-sm font-mono text-gray-300 whitespace-pre overflow-x-auto">
          <code>
            &lt;file_map&gt;
            {lines.map((line, index) => {
              // Check if this line contains a selected file marker (for syntax highlighting)
              const isSelected = options.highlightSelected && 
                (line.includes('[selected]') || 
                 (allFiles && selectedFiles.some(sf => 
                   line.includes(sf.relativePath) && !sf.isDirectory)));
              
              return (
                <div 
                  key={index}
                  className={clsx(
                    "hover:bg-gray-800/50",
                    isSelected && "text-blue-300"
                  )}
                >
                  {line}
                </div>
              );
            })}
            &lt;/file_map&gt;
          </code>
        </pre>
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        Note: This is a preview. The actual copied output will not include any additional formatting or syntax highlighting.
      </div>
    </div>
  );
} 