import React, { useState, useEffect, useCallback } from 'react';
import IgnoredPathsInfo from './IgnoredPathsInfo';
import BinaryFilterSettings from './BinaryFilterSettings';
import { BinaryDetectionOptions, ScanResults as ScanResultsType } from '../types/common';

interface ScanProgressProps {
  fileCount: number;
  totalSize: number;
  totalTokens: number;
  processing: string;
  skippedCount?: number;
  binaryCount?: number;
  sizeSkippedCount?: number;
  error?: boolean;
  message?: string;
  done?: boolean;
}

interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  isDirectory: boolean;
  isSkipped: boolean;
  tokenEstimate: number;
}

interface ScanResults {
  rootPath: string;
  files: FileInfo[];
  stats: {
    fileCount: number;
    totalSize: number;
    totalTokens: number;
    skippedCount?: number;
    binaryCount?: number;
    sizeSkippedCount?: number;
  };
}

interface DirectoryScannerProps {
  folderPath: string | null;
  onScanComplete?: (results: ScanResultsType) => void;
}

// Helper to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Default binary detection options
const DEFAULT_BINARY_OPTIONS: BinaryDetectionOptions = {
  maxSizeBytes: 1024 * 1024, // 1MB
  checkContent: true,
  checkExtension: true,
  sampleSize: 512,
  binaryThreshold: 10
};

// Ensure the window.api interface includes the new options
declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<string | null>;
      verifyDroppedFolder: (path: string) => Promise<string | null>;
      walkDirectory: (path: string, options?: any) => Promise<ScanResultsType>;
      readFileContent: (path: string, options?: any) => Promise<any>;
      checkBinaryStatus: (path: string, options?: any) => Promise<any>;
      writeToClipboard: (payload: string) => Promise<any>;
      onWalkProgress: (callback: (data: any) => void) => () => void;
    };
  }
}

export default function DirectoryScanner({ folderPath, onScanComplete }: DirectoryScannerProps): JSX.Element {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgressProps | null>(null);
  const [results, setResults] = useState<ScanResultsType | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Binary detection options state
  const [binaryOptions, setBinaryOptions] = useState<BinaryDetectionOptions>(DEFAULT_BINARY_OPTIONS);
  const [showRescan, setShowRescan] = useState(false);

  // Start scanning when folderPath changes
  useEffect(() => {
    if (folderPath) {
      startScan(folderPath);
    }
  }, [folderPath]);

  // Setup progress listener
  useEffect(() => {
    if (!window.api?.onWalkProgress) return;
    
    const removeListener = window.api.onWalkProgress((data: ScanProgressProps) => {
      setProgress(data);
      
      if (data.error) {
        setError(data.message || 'Unknown error occurred during scan');
        setScanning(false);
      }
      
      if (data.done) {
        setScanning(false);
      }
    });
    
    // Clean up listener
    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  // Handle binary options change
  const handleBinaryOptionsChange = (newOptions: BinaryDetectionOptions) => {
    setBinaryOptions(newOptions);
    // Show rescan button when options are changed
    if (results) {
      setShowRescan(true);
    }
  };

  const startScan = useCallback(async (path: string) => {
    setScanning(true);
    setError(null);
    setProgress(null);
    setResults(null);
    setShowRescan(false);
    try {
      // Pass binary detection options to the scanner
      const scanResults = await window.api.walkDirectory(path, {
        binaryDetection: binaryOptions
      });

      // Set results on successful scan
      setResults(scanResults);
      if (onScanComplete) {
        onScanComplete(scanResults);
      }
    } catch (error: any) {
      console.error('Error scanning directory:', error);
      setError('Failed to scan directory. Please try again.');
    } finally {
      setScanning(false);
    }
  }, [onScanComplete, binaryOptions]);

  // Trigger a rescan with the current binary options
  const handleRescan = () => {
    if (folderPath) {
      startScan(folderPath);
    }
  };

  if (!folderPath) {
    return <div className="text-center py-4 text-gray-400">No folder selected</div>;
  }

  return (
    <div className="mt-6 w-full">
      <h2 className="text-xl font-semibold mb-4 text-gray-200">Directory Scan</h2>
      
      {/* Binary Filter Settings */}
      <div className="mb-4">
        <BinaryFilterSettings 
          options={binaryOptions}
          onOptionsChange={handleBinaryOptionsChange}
        />
        
        {showRescan && !scanning && (
          <div className="mt-2 p-2 bg-blue-900/30 border border-blue-700 rounded text-blue-300 text-sm flex justify-between items-center">
            <span>Binary detection settings have changed. Rescan to apply changes.</span>
            <button 
              onClick={handleRescan}
              className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs font-medium"
            >
              Rescan
            </button>
          </div>
        )}
      </div>
      
      {scanning && progress && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <div className="mb-2 flex justify-between">
            <span className="text-gray-300">Scanning folder...</span>
            <span className="text-gray-400">{progress.fileCount} files</span>
          </div>
          
          <div className="h-2 w-full bg-gray-700 rounded overflow-hidden">
            {/* Cannot show deterministic progress bar as we don't know total files in advance */}
            <div className="h-full bg-blue-600 animate-pulse" style={{ width: '100%' }}></div>
          </div>
          
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-gray-400">Processing: {progress.processing}</span>
            <span className="text-gray-400">
              Size: {formatFileSize(progress.totalSize)} | 
              Tokens: {progress.totalTokens.toLocaleString()}
            </span>
          </div>

          {progress.skippedCount !== undefined && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-400">
              <div>Skipped: {progress.skippedCount}</div>
              {progress.binaryCount !== undefined && <div>Binary: {progress.binaryCount}</div>}
              {progress.sizeSkippedCount !== undefined && <div>Size limit: {progress.sizeSkippedCount}</div>}
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
          {error}
        </div>
      )}
      
      {results && !scanning && (
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-medium mb-3 text-gray-200">Scan Complete</h3>
          
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="p-3 bg-gray-700 rounded-lg">
              <div className="text-xl font-semibold text-gray-200">
                {results.stats.fileCount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">Files</div>
            </div>
            
            <div className="p-3 bg-gray-700 rounded-lg">
              <div className="text-xl font-semibold text-gray-200">
                {formatFileSize(results.stats.totalSize)}
              </div>
              <div className="text-sm text-gray-400">Total Size</div>
            </div>
            
            <div className="p-3 bg-gray-700 rounded-lg">
              <div className="text-xl font-semibold text-gray-200">
                {results.stats.totalTokens.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">Estimated Tokens</div>
            </div>
          </div>
          
          {/* Additional stats for skipped files */}
          {results.stats.skippedCount !== undefined && (
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div className="p-3 bg-gray-700/50 rounded-lg">
                <div className="text-lg font-medium text-yellow-400">
                  {results.stats.skippedCount}
                </div>
                <div className="text-sm text-gray-400">Files Skipped</div>
              </div>
              
              {results.stats.binaryCount !== undefined && (
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="text-lg font-medium text-yellow-400">
                    {results.stats.binaryCount}
                  </div>
                  <div className="text-sm text-gray-400">Binary Files</div>
                </div>
              )}
              
              {results.stats.sizeSkippedCount !== undefined && (
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="text-lg font-medium text-yellow-400">
                    {results.stats.sizeSkippedCount}
                  </div>
                  <div className="text-sm text-gray-400">Size Limit Exceeded</div>
                </div>
              )}
            </div>
          )}
          
          <div className="text-sm text-gray-400 mb-2">
            Path: <span className="text-gray-300">{results.rootPath}</span>
          </div>
          
          <div className="text-sm text-gray-400">
            <span className="text-yellow-500">
              {results.files.filter(f => f.isSkipped).length} files skipped
            </span>
            {' '}(binary or size limit exceeded)
          </div>
          
          <IgnoredPathsInfo rootPath={results.rootPath} />
        </div>
      )}
    </div>
  );
}