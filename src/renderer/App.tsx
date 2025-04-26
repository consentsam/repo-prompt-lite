import React, { useState, useMemo } from 'react';
import FolderPicker from './components/FolderPicker';
import DirectoryScanner from './components/DirectoryScanner';
import FileTree from './components/FileTree';
import FileMapPreview from './components/FileMapPreview';
import clsx from 'clsx';
import { FileInfo, ScanResults } from './types/common';
import { 
  getSelectedFiles, 
  getTotalTokenCount, 
  isExceedingTokenLimit, 
  getTokenUsagePercentage,
  formatNumber
} from './utils/selectionUtils';
import { copyPromptToClipboard } from './utils/promptUtils';

// Token limits
const TOKEN_LIMIT = 2000000; // 2 million tokens
const WARNING_THRESHOLD = 90; // 90% of limit

export default function App(): JSX.Element {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFolderSelected = (folderPath: string) => {
    setSelectedFolder(folderPath);
    setScanResults(null); // Reset scan results when a new folder is selected
    setSelectedFiles([]); // Reset selected files
    setShowPreview(false);
    setCopyResult(null);
  };

  const handleScanComplete = (results: ScanResults) => {
    setScanResults(results);
    console.log('Scan completed:', results);
  };

  const handleSelectionChange = (files: FileInfo[]) => {
    setSelectedFiles(files);
    console.log('Selected files:', files.length);
    setShowPreview(false); // Hide preview when selection changes
    setCopyResult(null); // Reset copy result when selection changes
  };

  const togglePreview = () => {
    setShowPreview(prev => !prev);
  };

  // Process the selection - memoize to avoid recomputing on every render
  const processedSelection = useMemo(() => {
    const filteredFiles = getSelectedFiles(selectedFiles);
    const totalTokens = getTotalTokenCount(filteredFiles);
    const tokenPercentage = getTokenUsagePercentage(filteredFiles, TOKEN_LIMIT);
    const exceedsLimit = isExceedingTokenLimit(filteredFiles, TOKEN_LIMIT);
    const isWarning = tokenPercentage >= WARNING_THRESHOLD;
    
    return {
      files: filteredFiles,
      count: filteredFiles.length,
      totalTokens,
      tokenPercentage,
      exceedsLimit,
      isWarning
    };
  }, [selectedFiles]);

  // Extract base folder name from the root path
  const rootFolderName = useMemo(() => {
    if (!scanResults?.rootPath) return undefined;
    return scanResults.rootPath.split('/').pop();
  }, [scanResults?.rootPath]);

  // Handle copying to clipboard
  const handleCopyToClipboard = async () => {
    if (processedSelection.count === 0 || processedSelection.exceedsLimit) return;
    
    setIsCopying(true);
    setCopyResult(null);
    
    try {
      const result = await copyPromptToClipboard(processedSelection.files, rootFolderName);
      
      if (result.success) {
        setCopyResult({
          success: true,
          message: `Successfully copied ${processedSelection.count} files to clipboard!`
        });
      } else {
        setCopyResult({
          success: false,
          message: result.error || 'Failed to copy to clipboard.'
        });
      }
    } catch (error) {
      setCopyResult({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred.'
      });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-4">Repo Prompt Lite</h1>
      <p className="text-gray-400 mb-8">Select a folder to generate code prompt</p>
      
      <div className="w-full max-w-4xl">
        <FolderPicker onFolderSelected={handleFolderSelected} />
        
        {selectedFolder && (
          <DirectoryScanner 
            folderPath={selectedFolder}
            onScanComplete={handleScanComplete}
          />
        )}

        {scanResults && (
          <>
            <FileTree 
              files={scanResults.files}
              rootPath={scanResults.rootPath}
              onSelectionChange={handleSelectionChange}
            />
            
            {processedSelection.count > 0 && (
              <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium text-gray-200">Selection</h3>
                  <span className={clsx(
                    "text-sm",
                    processedSelection.exceedsLimit ? "text-red-400" : 
                    processedSelection.isWarning ? "text-yellow-400" : "text-gray-400"
                  )}>
                    {formatNumber(processedSelection.count)} files • {formatNumber(processedSelection.totalTokens)} tokens
                    {' '}({processedSelection.tokenPercentage.toFixed(1)}% of limit)
                  </span>
                </div>
                
                {(processedSelection.isWarning || processedSelection.exceedsLimit) && (
                  <div className={clsx(
                    "mb-3 p-2 text-sm rounded",
                    processedSelection.exceedsLimit 
                      ? "bg-red-900/30 border border-red-700 text-red-400"
                      : "bg-yellow-900/30 border border-yellow-700 text-yellow-400"
                  )}>
                    {processedSelection.exceedsLimit
                      ? `Selection exceeds the ${formatNumber(TOKEN_LIMIT)} token limit. Please reduce your selection.`
                      : `Selection is approaching the ${formatNumber(TOKEN_LIMIT)} token limit (${WARNING_THRESHOLD}%).`}
                  </div>
                )}
                
                <div className="mb-2 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className={clsx(
                      "h-full", 
                      processedSelection.exceedsLimit 
                        ? "bg-red-600" 
                        : processedSelection.isWarning 
                          ? "bg-yellow-500" 
                          : "bg-blue-600"
                    )}
                    style={{ width: `${Math.min(processedSelection.tokenPercentage, 100)}%` }}
                  />
                </div>
                
                {copyResult && (
                  <div className={clsx(
                    "mb-3 p-2 text-sm rounded",
                    copyResult.success 
                      ? "bg-green-900/30 border border-green-700 text-green-400" 
                      : "bg-red-900/30 border border-red-700 text-red-400"
                  )}>
                    {copyResult.message}
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <button 
                    className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={processedSelection.count === 0 || processedSelection.exceedsLimit || isCopying}
                    onClick={handleCopyToClipboard}
                  >
                    {isCopying ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Copying...
                      </span>
                    ) : "Copy to Clipboard"}
                  </button>
                  
                  <button 
                    className={clsx(
                      "px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 font-medium",
                      showPreview
                        ? "bg-gray-600 hover:bg-gray-700 text-gray-200"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    )}
                    onClick={togglePreview}
                    disabled={processedSelection.count === 0}
                  >
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
              </div>
            )}
            
            {showPreview && processedSelection.count > 0 && (
              <FileMapPreview 
                selectedFiles={processedSelection.files}
                rootFolderName={rootFolderName}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
} 