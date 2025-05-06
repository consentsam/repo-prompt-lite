import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { TreeFormatOptions } from '../utils/formatUtils';
import TokenCounter from './TokenCounter';
import { FileInfo } from '../types/common';

interface ToolbarProps {
  selectedFiles: FileInfo[];
  tokenLimit: number;
  warningThreshold: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onTogglePreview: () => void;
  onToggleStats: () => void;
  showPreview: boolean;
  showStats: boolean;
  isCopying: boolean;
  onCopyToClipboard: () => void;
  exceedsLimit: boolean;
  className?: string;
}

export default function Toolbar({
  selectedFiles,
  tokenLimit,
  warningThreshold,
  onExpandAll,
  onCollapseAll,
  onSelectAll,
  onDeselectAll,
  onTogglePreview,
  onToggleStats,
  showPreview,
  showStats,
  isCopying,
  onCopyToClipboard,
  exceedsLimit,
  className
}: ToolbarProps): JSX.Element {
  console.log('[Toolbar.tsx] Render/Re-render. Props received:', {
    selectedFilesCount: selectedFiles.length,
    tokenLimit,
    warningThreshold,
    showPreview,
    showStats,
    isCopying,
    exceedsLimit
  });

  // Track active hotkeys
  const [activeHotkeys, setActiveHotkeys] = useState<Record<string, boolean>>({});
  
  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      console.log('[Toolbar.tsx] handleKeyDown:', e.key, 'Ctrl/Meta:', e.ctrlKey || e.metaKey);
      // Only handle when not typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Check for keyboard shortcuts
      // Cmd/Ctrl + key combinations
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'a') {
          e.preventDefault();
          onSelectAll();
          setActiveHotkeys(prev => ({ ...prev, 'Cmd+A': true }));
        } else if (e.key === 'd') {
          e.preventDefault();
          onDeselectAll();
          setActiveHotkeys(prev => ({ ...prev, 'Cmd+D': true }));
        } else if (e.key === 'c' && !exceedsLimit && !isCopying) {
          // Don't prevent default here to allow native copy operation
          // but also trigger our clipboard function
          onCopyToClipboard();
          setActiveHotkeys(prev => ({ ...prev, 'Cmd+C': true }));
        }
      } else {
        // Single key shortcuts
        switch (e.key) {
          case 'e':
            onExpandAll();
            setActiveHotkeys(prev => ({ ...prev, 'E': true }));
            break;
          case 'w':
            onCollapseAll();
            setActiveHotkeys(prev => ({ ...prev, 'W': true }));
            break;
          case 'p':
            onTogglePreview();
            setActiveHotkeys(prev => ({ ...prev, 'P': true }));
            break;
          case 's':
            onToggleStats();
            setActiveHotkeys(prev => ({ ...prev, 'S': true }));
            break;
        }
      }
    }
    
    function handleKeyUp(e: KeyboardEvent) {
      // Reset active hotkeys
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        setActiveHotkeys(prev => ({ ...prev, 'Cmd+A': false }));
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        setActiveHotkeys(prev => ({ ...prev, 'Cmd+D': false }));
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        setActiveHotkeys(prev => ({ ...prev, 'Cmd+C': false }));
      } else if (e.key === 'e') {
        setActiveHotkeys(prev => ({ ...prev, 'E': false }));
      } else if (e.key === 'w') {
        setActiveHotkeys(prev => ({ ...prev, 'W': false }));
      } else if (e.key === 'p') {
        setActiveHotkeys(prev => ({ ...prev, 'P': false }));
      } else if (e.key === 's') {
        setActiveHotkeys(prev => ({ ...prev, 'S': false }));
      }
    }
    
    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    onExpandAll, 
    onCollapseAll, 
    onSelectAll, 
    onDeselectAll, 
    onTogglePreview, 
    onToggleStats, 
    onCopyToClipboard,
    exceedsLimit,
    isCopying
  ]);
  
  // Helper to render keyboard shortcut badge
  const ShortcutBadge = ({ shortcut }: { shortcut: string }) => {
    const isActive = activeHotkeys[shortcut];
    return (
      <span className={clsx(
        "text-xs px-1.5 py-0.5 rounded ml-1.5 border border-gray-600",
        isActive ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-400"
      )}>
        {shortcut}
      </span>
    );
  };
  
  const handleExpandAllClick = () => { console.log('[Toolbar.tsx] Expand All button clicked'); onExpandAll(); };
  const handleCollapseAllClick = () => { console.log('[Toolbar.tsx] Collapse All button clicked'); onCollapseAll(); };
  const handleSelectAllClick = () => { console.log('[Toolbar.tsx] Select All button clicked'); onSelectAll(); };
  const handleDeselectAllClick = () => { console.log('[Toolbar.tsx] Deselect All button clicked'); onDeselectAll(); };
  const handleTogglePreviewClick = () => { console.log('[Toolbar.tsx] Toggle Preview button clicked'); onTogglePreview(); };
  const handleToggleStatsClick = () => { console.log('[Toolbar.tsx] Toggle Stats button clicked'); onToggleStats(); };
  const handleCopyToClipboardClick = () => { console.log('[Toolbar.tsx] Copy to Clipboard button clicked'); onCopyToClipboard(); };

  return (
    <div className={clsx("toolbar p-2 bg-gray-800 rounded-md border border-gray-700 mb-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* File Tree Controls */}
        <div className="flex space-x-1">
          <button 
            onClick={handleExpandAllClick}
            className="px-2 py-1 text-sm text-gray-300 hover:bg-gray-700 rounded flex items-center"
            title="Expand all folders"
          >
            <svg className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Expand
            <ShortcutBadge shortcut="E" />
          </button>
          
          <button 
            onClick={handleCollapseAllClick}
            className="px-2 py-1 text-sm text-gray-300 hover:bg-gray-700 rounded flex items-center"
            title="Collapse all folders"
          >
            <svg className="w-4 h-4 mr-1 transform rotate-180" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Collapse
            <ShortcutBadge shortcut="W" />
          </button>
        </div>
        
        {/* Selection Controls */}
        <div className="flex space-x-1">
          <button 
            onClick={handleSelectAllClick}
            className="px-2 py-1 text-sm text-gray-300 hover:bg-gray-700 rounded flex items-center"
            title="Select all files"
          >
            <svg className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
            Select All
            <ShortcutBadge shortcut="Cmd+A" />
          </button>
          
          <button 
            onClick={handleDeselectAllClick}
            className="px-2 py-1 text-sm text-gray-300 hover:bg-gray-700 rounded flex items-center"
            title="Deselect all files"
          >
            <svg className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Deselect All
            <ShortcutBadge shortcut="Cmd+D" />
          </button>
        </div>
        
        {/* View Controls */}
        <div className="flex space-x-1">
          <button 
            onClick={handleTogglePreviewClick}
            className={clsx(
              "px-2 py-1 text-sm rounded flex items-center",
              showPreview
                ? "bg-gray-600 text-gray-200"
                : "text-gray-300 hover:bg-gray-700"
            )}
            title="Toggle preview"
          >
            <svg className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            Preview
            <ShortcutBadge shortcut="P" />
          </button>
          
          <button 
            onClick={handleToggleStatsClick}
            className={clsx(
              "px-2 py-1 text-sm rounded flex items-center",
              showStats
                ? "bg-gray-600 text-gray-200"
                : "text-gray-300 hover:bg-gray-700"
            )}
            title="Toggle statistics"
          >
            <svg className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
            </svg>
            Stats
            <ShortcutBadge shortcut="S" />
          </button>
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-2">
        {/* Token Counter */}
        <TokenCounter 
          selectedFiles={selectedFiles}
          tokenLimit={tokenLimit}
          warningThreshold={warningThreshold}
        />
        
        {/* Copy Button */}
        {selectedFiles.length === 0 ? (
          <div className="text-blue-400 flex items-center bg-blue-900/20 px-3 py-2 rounded-md border border-blue-800">
            <svg className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>Select files from the tree below to enable copying</span>
          </div>
        ) : (
          <button 
            className={clsx(
              "px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white font-medium flex items-center",
              (exceedsLimit || isCopying) && "opacity-50 cursor-not-allowed"
            )}
            disabled={exceedsLimit || isCopying}
            onClick={handleCopyToClipboardClick}
            title={exceedsLimit ? "Token limit exceeded" : "Copy to clipboard"}
          >
            {isCopying ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Copying...
              </span>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                  <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                </svg>
                Copy to Clipboard
                <ShortcutBadge shortcut="Cmd+C" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
} 