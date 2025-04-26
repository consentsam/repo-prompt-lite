import React, { useState, useEffect, useCallback } from 'react';

interface ScanProgressProps {
  fileCount: number;
  totalSize: number;
  totalTokens: number;
  processing: string;
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
  };
}

interface DirectoryScannerProps {
  folderPath: string | null;
  onScanComplete?: (results: ScanResults) => void;
}

// Helper to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export default function DirectoryScanner({ folderPath, onScanComplete }: DirectoryScannerProps): JSX.Element {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgressProps | null>(null);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const startScan = useCallback(async (path: string) => {
    try {
      setScanning(true);
      setError(null);
      setProgress(null);
      setResults(null);
      
      const scanResults = await window.api.walkDirectory(path);
      setResults(scanResults);
      
      if (onScanComplete) {
        onScanComplete(scanResults);
      }
      
    } catch (error) {
      console.error('Error scanning directory:', error);
      setError('Failed to scan directory. Please try again.');
      setScanning(false);
    }
  }, [onScanComplete]);

  if (!folderPath) {
    return <div className="text-center py-4 text-gray-400">No folder selected</div>;
  }

  return (
    <div className="mt-6 w-full">
      <h2 className="text-xl font-semibold mb-4 text-gray-200">Directory Scan</h2>
      
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
          
          <div className="text-sm text-gray-400 mb-2">
            Path: <span className="text-gray-300">{results.rootPath}</span>
          </div>
          
          <div className="text-sm text-gray-400">
            <span className="text-yellow-500">
              {results.files.filter(f => f.isSkipped).length} files skipped
            </span>
            {' '}(binary or ≥ 1MB)
          </div>
        </div>
      )}
    </div>
  );
} 