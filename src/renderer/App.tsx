import React, { useState, useMemo, useEffect } from 'react';
import FolderPicker from './components/FolderPicker';
import DirectoryScanner from './components/DirectoryScanner';
import FileTree from './components/FileTree';
import FileMapPreview from './components/FileMapPreview';
import SelectionStats from './components/SelectionStats';
import TokenCounter from './components/TokenCounter';
import Toolbar from './components/Toolbar';
import clsx from 'clsx';
import { FileInfo, ScanResults } from './types/common';
import { 
  getSelectedFiles, 
  getTotalTokenCount, 
  isExceedingTokenLimit, 
  getTokenUsagePercentage,
  formatNumber
} from './utils/selectionUtils';
import { copyPromptToClipboard, DEFAULT_PROMPT_OPTIONS, MAX_TOKEN_LIMIT } from './utils/promptUtils';
import { TreeFormatOptions } from './utils/formatUtils';

// Token limits - sync with promptUtils
const TOKEN_LIMIT = MAX_TOKEN_LIMIT; // 2 million tokens
const WARNING_THRESHOLD = 90; // 90% of limit

export default function App(): JSX.Element {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showStats, setShowStats] = useState(true); // Show stats by default
  const [fileMapOptions, setFileMapOptions] = useState<TreeFormatOptions>(DEFAULT_PROMPT_OPTIONS);
  // New state for copy progress
  const [copyProgress, setCopyProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
    percentage: number;
  } | null>(null);

  // Reference to the FileTree component for expand/collapse methods
  const fileTreeRef = React.useRef<{
    expandAll: () => void;
    collapseAll: () => void;
    selectAll: () => void;
    deselectAll: () => void;
  } | null>(null);

  console.log('App component rendered/re-rendered');

  const handleFolderSelected = (folderPath: string) => {
    console.log('[App.tsx] handleFolderSelected called with path:', folderPath);
    setSelectedFolder(folderPath);
    setScanResults(null);
    setSelectedFiles([]);
    setShowPreview(false);
    setCopyResult(null);
  };

  const handleScanComplete = (results: ScanResults) => {
    console.log('[App.tsx] handleScanComplete. Total files scanned:', results.files.length);
    setScanResults(results);
  };

  const handleSelectionChange = (files: FileInfo[]) => {
    console.log('[App.tsx] handleSelectionChange_RECEIVED_FROM_FILETREE:', {
      count: files.length,
      filesSample: files.slice(0, 3).map(f => ({ path: f.relativePath, tokens: f.tokenEstimate, isDir: f.isDirectory, isSkipped: f.isSkipped, size: f.size })),
      allFilesReceived: files, // Log all if needed, but can be large
    });
    setSelectedFiles(files); // This triggers re-render and processedSelection recalculation
    setShowPreview(false);
    setCopyResult(null);
  };

  useEffect(() => {
    console.log('[App.tsx] selectedFiles state UPDATED:', {
      count: selectedFiles.length,
      filesSample: selectedFiles.slice(0, 3).map(f => ({ path: f.relativePath, tokens: f.tokenEstimate, isDir: f.isDirectory, isSkipped: f.isSkipped, size: f.size })),
    });
  }, [selectedFiles]);

  const togglePreview = () => {
    console.log('[App.tsx] togglePreview called. Current showPreview:', showPreview);
    setShowPreview(prev => !prev);
    if (!showPreview) setShowStats(false);
  };
  
  const toggleStats = () => {
    console.log('[App.tsx] toggleStats called. Current showStats:', showStats);
    setShowStats(prev => !prev);
    if (!showStats) setShowPreview(false);
  };

  const expandAll = () => {
    console.log('[App.tsx] expandAll called');
    fileTreeRef.current?.expandAll();
  };
  
  const collapseAll = () => {
    console.log('[App.tsx] collapseAll called');
    fileTreeRef.current?.collapseAll();
  };
  
  const selectAll = () => {
    console.log('[App.tsx] selectAll called');
    fileTreeRef.current?.selectAll();
  };
  
  const deselectAll = () => {
    console.log('[App.tsx] deselectAll called');
    fileTreeRef.current?.deselectAll();
  };

  const handleFileMapOptionsChange = (options: TreeFormatOptions) => {
    console.log('[App.tsx] handleFileMapOptionsChange called with options:', options);
    setFileMapOptions(options);
  };

  const processedSelection = useMemo(() => {
    console.log('[App.tsx] useMemo processedSelection recalculating. Input selectedFiles count:', selectedFiles.length);
    const filteredFiles = getSelectedFiles(selectedFiles);
    const totalTokens = getTotalTokenCount(filteredFiles);
    const tokenPercentage = getTokenUsagePercentage(filteredFiles, TOKEN_LIMIT);
    const exceedsLimit = isExceedingTokenLimit(filteredFiles, TOKEN_LIMIT);
    const isWarning = tokenPercentage >= WARNING_THRESHOLD;

    console.log('[App.tsx] useMemo processedSelection_RESULT:', {
      inputCount: selectedFiles.length,
      filteredCount: filteredFiles.length,
      totalTokens,
      // firstFilteredFile: filteredFiles[0] ? {path: filteredFiles[0].relativePath, tokens: filteredFiles[0].tokenEstimate} : null,
      exceedsLimit: isExceedingTokenLimit(filteredFiles, TOKEN_LIMIT),
      isWarning: getTokenUsagePercentage(filteredFiles, TOKEN_LIMIT) >= WARNING_THRESHOLD,
      filesSample: filteredFiles.slice(0,3).map(f => ({ path: f.relativePath, tokens: f.tokenEstimate, isDir: f.isDirectory, isSkipped: f.isSkipped, size: f.size }))
    });
    return {
      files: filteredFiles,
      count: filteredFiles.length,
      totalTokens,
      tokenPercentage: getTokenUsagePercentage(filteredFiles, TOKEN_LIMIT),
      exceedsLimit: isExceedingTokenLimit(filteredFiles, TOKEN_LIMIT),
      isWarning: getTokenUsagePercentage(filteredFiles, TOKEN_LIMIT) >= WARNING_THRESHOLD
    };
  }, [selectedFiles]);

  // Extract base folder name from the root path
  const rootFolderName = useMemo(() => {
    if (!scanResults?.rootPath) return undefined;
    return scanResults.rootPath.split('/').pop();
  }, [scanResults?.rootPath]);

  // Handle copying to clipboard
  const handleCopyToClipboard = async () => {
    console.log('[App.tsx] handleCopyToClipboard called. Processed selection count:', processedSelection.count, 'Exceeds limit:', processedSelection.exceedsLimit);
    if (processedSelection.count === 0 || processedSelection.exceedsLimit) {
      console.log('[App.tsx] CopyToClipboard aborted: no files or exceeds limit.');
      return;
    }
    
    setIsCopying(true);
    setCopyResult(null);
    setCopyProgress(null);
    
    try {
      // Track progress of file processing
      const onProgress = (progress: {
        current: number;
        total: number;
        fileName: string;
        percentage: number;
      }) => {
        setCopyProgress(progress);
      };
      
      const result = await copyPromptToClipboard(
        processedSelection.files, 
        rootFolderName,
        scanResults?.files,  // Pass all files to show complete repo structure
        fileMapOptions,      // Pass the current file map options
        onProgress           // Pass the progress callback
      );
      
      if (result.success) {
        let message = `Successfully copied ${result.processedFiles} files to clipboard!`;
        
        // Add info about token cap if it was exceeded
        if (result.tokenCapExceeded) {
          message += ` (${result.processedFiles}/${result.totalFiles} files, token limit reached)`;
        }
        
        setCopyResult({
          success: true,
          message
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
      setCopyProgress(null);
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
            {/* Always show toolbar when scanResults are available */}
            <Toolbar 
              selectedFiles={processedSelection.files}
              tokenLimit={TOKEN_LIMIT}
              warningThreshold={WARNING_THRESHOLD}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onTogglePreview={togglePreview}
              onToggleStats={toggleStats}
              showPreview={showPreview}
              showStats={showStats}
              isCopying={isCopying}
              onCopyToClipboard={handleCopyToClipboard}
              exceedsLimit={processedSelection.count === 0 || processedSelection.exceedsLimit}
            />
            
            <FileTree 
              files={scanResults.files}
              rootPath={scanResults.rootPath}
              onSelectionChange={handleSelectionChange}
              onFilesUpdate={(updatedFiles) => {
                // Update scan results with lazy loaded files
                setScanResults(prevResults => {
                  if (!prevResults) return null;
                  return {
                    ...prevResults,
                    files: updatedFiles
                  };
                });
              }}
              ref={fileTreeRef}
            />
            
            {processedSelection.count > 0 && (
              <div className="mt-4">
                {/* Copy progress indicator */}
                {isCopying && copyProgress && (
                  <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 text-blue-300 rounded-md">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Processing: {copyProgress.fileName}</span>
                      <span className="text-sm">{copyProgress.current}/{copyProgress.total} files</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                        style={{ width: `${copyProgress.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {copyResult && (
                  <div className={clsx(
                    "mb-4 p-3 text-sm rounded-md",
                    copyResult.success 
                      ? "bg-green-900/30 border border-green-700 text-green-400" 
                      : "bg-red-900/30 border border-red-700 text-red-400"
                  )}>
                    {copyResult.message}
                  </div>
                )}
                
                {/* Show the stats or preview based on user selection */}
                {showStats && (
                  <SelectionStats 
                    selectedFiles={processedSelection.files}
                    tokenLimit={TOKEN_LIMIT}
                    warningThreshold={WARNING_THRESHOLD}
                  />
                )}
                
                {showPreview && (
                  <FileMapPreview 
                    selectedFiles={processedSelection.files}
                    rootFolderName={rootFolderName}
                    allFiles={scanResults?.files}
                    options={fileMapOptions}
                    onOptionsChange={handleFileMapOptionsChange}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 