import React, { useState } from 'react';
import clsx from 'clsx';
import { BinaryDetectionOptions } from '../types/common';

interface BinaryFilterSettingsProps {
  options: BinaryDetectionOptions;
  onOptionsChange: (options: BinaryDetectionOptions) => void;
  className?: string;
}

/**
 * Component for configuring binary file filter settings
 */
export default function BinaryFilterSettings({
  options,
  onOptionsChange,
  className
}: BinaryFilterSettingsProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleMaxSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sizeInMB = parseFloat(e.target.value);
    if (!isNaN(sizeInMB) && sizeInMB > 0) {
      onOptionsChange({
        ...options,
        maxSizeBytes: sizeInMB * 1024 * 1024 // Convert MB to bytes
      });
    }
  };
  
  const handleCheckboxChange = (key: keyof BinaryDetectionOptions) => {
    onOptionsChange({
      ...options,
      [key]: !options[key as keyof BinaryDetectionOptions]
    });
  };
  
  const handleSampleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sampleSize = parseInt(e.target.value, 10);
    if (!isNaN(sampleSize) && sampleSize > 0) {
      onOptionsChange({
        ...options,
        sampleSize
      });
    }
  };
  
  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const threshold = parseInt(e.target.value, 10);
    if (!isNaN(threshold) && threshold >= 0 && threshold <= 100) {
      onOptionsChange({
        ...options,
        binaryThreshold: threshold
      });
    }
  };
  
  // Calculate current max size in MB for display
  const maxSizeMB = options.maxSizeBytes ? (options.maxSizeBytes / (1024 * 1024)).toFixed(1) : '1.0';
  
  return (
    <div className={clsx('bg-gray-800 rounded-lg overflow-hidden', className)}>
      <div 
        className="p-3 bg-gray-700 flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-sm font-medium text-white">Binary & Large File Settings</h3>
        <button className="text-gray-400 hover:text-white focus:outline-none">
          <svg 
            className={clsx("h-5 w-5 transition-transform", isExpanded ? "transform rotate-180" : "")} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Maximum file size setting */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Maximum File Size: {maxSizeMB} MB
            </label>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={maxSizeMB}
              onChange={handleMaxSizeChange}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>100 KB</span>
              <span>10 MB</span>
            </div>
          </div>
          
          {/* Content-based detection settings */}
          <div>
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="contentCheck"
                checked={options.checkContent}
                onChange={() => handleCheckboxChange('checkContent')}
                className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
              />
              <label htmlFor="contentCheck" className="ml-2 text-sm font-medium text-gray-300">
                Enable content-based detection
              </label>
            </div>
            
            {options.checkContent && (
              <div className="ml-6 space-y-3 mt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Sample Size: {options.sampleSize} bytes
                  </label>
                  <input
                    type="range"
                    min="256"
                    max="4096"
                    step="256"
                    value={options.sampleSize}
                    onChange={handleSampleSizeChange}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Binary Threshold: {options.binaryThreshold}%
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={options.binaryThreshold}
                    onChange={handleThresholdChange}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    Percentage of non-text characters to consider a file binary
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Extension-based detection setting */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="extensionCheck"
              checked={options.checkExtension}
              onChange={() => handleCheckboxChange('checkExtension')}
              className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
            />
            <label htmlFor="extensionCheck" className="ml-2 text-sm font-medium text-gray-300">
              Enable extension-based detection
            </label>
          </div>
          
          <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-700/50 rounded border border-gray-600">
            Note: Binary and large files are automatically excluded during prompt generation.
            These settings affect how files are classified as binary or text.
          </div>
        </div>
      )}
    </div>
  );
} 