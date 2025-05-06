import React, { useMemo } from 'react';
import clsx from 'clsx';
import { FileInfo } from '../types/common';
import { 
  getFileStats, 
  formatNumber, 
  formatFileSize,
  getTotalTokenCount,
  getTokenUsagePercentage,
  isExceedingTokenLimit
} from '../utils/selectionUtils';

interface SelectionStatsProps {
  selectedFiles: FileInfo[];
  tokenLimit?: number;
  warningThreshold?: number;
}

export default function SelectionStats({ 
  selectedFiles, 
  tokenLimit = 2000000, 
  warningThreshold = 90 
}: SelectionStatsProps): JSX.Element {
  // Calculate stats only when selection changes
  const stats = useMemo(() => {
    return getFileStats(selectedFiles);
  }, [selectedFiles]);
  
  // Calculate token usage percentage
  const tokenPercentage = useMemo(() => {
    return getTokenUsagePercentage(selectedFiles, tokenLimit);
  }, [selectedFiles, tokenLimit]);
  
  // Check if we're exceeding token limit
  const exceedsLimit = useMemo(() => {
    return isExceedingTokenLimit(selectedFiles, tokenLimit);
  }, [selectedFiles, tokenLimit]);
  
  // Check if we're approaching token limit
  const isWarning = useMemo(() => {
    return tokenPercentage >= warningThreshold;
  }, [tokenPercentage, warningThreshold]);
  
  // No selection
  if (selectedFiles.length === 0) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg text-gray-400 text-center">
        No files selected. Select files from the tree to see statistics.
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-gray-800 rounded-lg text-gray-200">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium">Selection Statistics</h3>
        <span className={clsx(
          "text-sm font-mono",
          exceedsLimit ? "text-red-400" : 
          isWarning ? "text-yellow-400" : "text-gray-400"
        )}>
          {formatNumber(stats.totalTokens)} tokens ({tokenPercentage.toFixed(1)}%)
        </span>
      </div>
      
      {/* Token usage progress bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div 
            className={clsx(
              "h-full", 
              exceedsLimit 
                ? "bg-red-600" 
                : isWarning 
                  ? "bg-yellow-500" 
                  : "bg-blue-600"
            )}
            style={{ width: `${Math.min(tokenPercentage, 100)}%` }}
          />
        </div>
        
        {(isWarning || exceedsLimit) && (
          <div className={clsx(
            "mt-2 p-2 text-sm rounded-md",
            exceedsLimit 
              ? "bg-red-900/30 border border-red-700 text-red-400"
              : "bg-yellow-900/30 border border-yellow-700 text-yellow-400"
          )}>
            {exceedsLimit
              ? `Selection exceeds the ${formatNumber(tokenLimit)} token limit. Please reduce your selection.`
              : `Selection is approaching the ${formatNumber(tokenLimit)} token limit (${warningThreshold}%).`}
          </div>
        )}
      </div>
      
      {/* Main stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="p-3 bg-gray-700 rounded-lg">
          <div className="text-xl font-semibold">{formatNumber(stats.totalFiles)}</div>
          <div className="text-sm text-gray-400">Files Selected</div>
        </div>
        
        <div className="p-3 bg-gray-700 rounded-lg">
          <div className="text-xl font-semibold">{formatFileSize(stats.totalSize)}</div>
          <div className="text-sm text-gray-400">Total Size</div>
        </div>
        
        <div className="p-3 bg-gray-700 rounded-lg">
          <div className="text-xl font-semibold">{stats.byExtension.length}</div>
          <div className="text-sm text-gray-400">File Types</div>
        </div>
      </div>
      
      {/* File type breakdown */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">File Type Breakdown</h4>
        <div className="bg-gray-700 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 text-xs font-medium text-gray-300 border-b border-gray-600">
            <div className="col-span-3 p-2">Extension</div>
            <div className="col-span-2 p-2 text-center">Files</div>
            <div className="col-span-3 p-2 text-right">Size</div>
            <div className="col-span-4 p-2 text-right">Tokens</div>
          </div>
          
          <div className="max-h-48 overflow-auto">
            {stats.byExtension.map((extStat, index) => (
              <div 
                key={extStat.extension} 
                className={clsx(
                  "grid grid-cols-12 text-xs",
                  index % 2 === 0 ? "bg-gray-700" : "bg-gray-700/50"
                )}
              >
                <div className="col-span-3 p-2 font-mono text-blue-300">.{extStat.extension}</div>
                <div className="col-span-2 p-2 text-center text-gray-300">{extStat.count}</div>
                <div className="col-span-3 p-2 text-right text-gray-300">{formatFileSize(extStat.size)}</div>
                <div className="col-span-4 p-2 text-right text-gray-300">
                  {formatNumber(extStat.tokens)}
                  <span className="text-gray-500 ml-1">
                    ({((extStat.tokens / stats.totalTokens) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 