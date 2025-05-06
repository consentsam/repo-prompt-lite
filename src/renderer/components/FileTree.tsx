import React, { useState, useMemo, useReducer, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { produce, enableMapSet } from 'immer';
import { FileInfo, CheckState, FlattenedFile } from '../types/common';
import { flattenSelection, formatFileSize as formatFileSizeUtil } from '../utils/selectionUtils';

// Enable Immer's MapSet plugin to work with Map and Set
enableMapSet();

// Icons for file and folder
const FolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg 
    className={clsx("w-5 h-5 mr-1.5", isOpen ? "text-blue-400" : "text-yellow-400")}
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor"
  >
    <path d={isOpen 
      ? "M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" 
      : "M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
  </svg>
);

// Enhanced FileIcon that shows different icons based on file type and skip reason
const FileIcon = ({ file }: { file: FlattenedFile }) => {
  const isSkipped = file.isSkipped;
  const skipReason = file.skipReason;
  const extension = file.relativePath.split('.').pop()?.toLowerCase() || '';
  
  // Binary file icon
  if (isSkipped && (skipReason === 'extension' || skipReason === 'content')) {
    return (
      <svg 
        className="w-5 h-5 mr-1.5 text-yellow-500"
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor"
      >
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
      </svg>
    );
  }
  
  // Large file icon
  if (isSkipped && skipReason === 'size') {
    return (
      <svg 
        className="w-5 h-5 mr-1.5 text-red-500"
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor"
      >
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
    );
  }
  
  // Ignored file icon
  if (isSkipped && skipReason === 'ignored') {
    return (
      <svg 
        className="w-5 h-5 mr-1.5 text-gray-500"
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor"
      >
        <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
      </svg>
    );
  }
  
  // Error file icon
  if (isSkipped && skipReason === 'error') {
    return (
      <svg 
        className="w-5 h-5 mr-1.5 text-red-500"
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor"
      >
        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
    );
  }
  
  // Regular file icon
  return (
    <svg 
      className={clsx("w-5 h-5 mr-1.5", isSkipped ? "text-gray-500" : "text-gray-400")}
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
      <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
    </svg>
  );
};

// Chevron icon for expand/collapse
const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg 
    className={clsx("w-4 h-4 transition-transform duration-200", 
      isOpen ? "transform rotate-90" : ""
    )}
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 20 20" 
    fill="currentColor"
  >
    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
  </svg>
);

// Component to show skip reason tooltip
const SkipReasonIndicator = ({ file }: { file: FlattenedFile }) => {
  if (!file.isSkipped || !file.skipReason) return null;
  
  let message = '';
  let color = 'text-yellow-500';
  
  switch (file.skipReason) {
    case 'extension':
      message = 'Binary file (by extension)';
      break;
    case 'content':
      message = 'Binary file (by content)';
      break;
    case 'size':
      message = 'Too large (≥ 1MB)';
      color = 'text-red-500';
      break;
    case 'ignored':
      message = 'In ignored directory';
      color = 'text-gray-500';
      break;
    case 'error':
      message = 'Error reading file';
      color = 'text-red-500';
      break;
    default:
      message = 'Skipped';
  }
  
  return (
    <div className={`ml-1 text-xs ${color}`}>
      {message}
    </div>
  );
};

// Tri-state checkbox component
const TriStateCheckbox = ({ state, onChange }: { state: CheckState, onChange: () => void }) => {
  console.log('[TriStateCheckbox] Rendered with state:', state);
  return (
    <button 
      onClick={(e) => {
        e.stopPropagation(); // Prevent row click
        console.log('[TriStateCheckbox] Clicked with state:', state);
        onChange();
      }}
      className={clsx(
        "w-5 h-5 mr-2 flex items-center justify-center rounded border",
        state === 'checked' 
          ? "bg-blue-600 border-blue-700" 
          : state === 'indeterminate' 
            ? "bg-blue-600/50 border-blue-700" 
            : "bg-gray-800 border-gray-600"
      )}
    >
      {state === 'checked' && (
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {state === 'indeterminate' && (
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
        </svg>
      )}
    </button>
  );
};

// Define the ref interface
export interface FileTreeHandle {
  expandAll: () => void;
  collapseAll: () => void;
  selectAll: () => void;
  deselectAll: () => void;
}

interface FileTreeProps {
  files: FileInfo[];
  rootPath: string;
  onSelectionChange?: (selectedFiles: FileInfo[]) => void;
  onFilesUpdate?: (updatedFiles: FileInfo[]) => void;
}

// Format file size helper
const formatFileSize = formatFileSizeUtil;

// Selection reducer types
type SelectionState = {
  nodeStates: Map<string, CheckState>;
};

type SelectionAction = 
  | { type: 'TOGGLE_NODE'; node: FlattenedFile }
  | { type: 'SET_NODE_STATE'; node: FlattenedFile; state: CheckState }
  | { type: 'SELECT_ALL'; nodes: FlattenedFile[] }
  | { type: 'DESELECT_ALL'; nodes: FlattenedFile[] }
  | { type: 'TOGGLE_VISIBLE_NODES'; nodes: FlattenedFile[] }
  | { type: 'INITIALIZE_STATES'; initialStates: Map<string, CheckState> };

// Add this helper near the top of the file
const DEBUG = true;
const logDebug = (message: string, ...data: any[]) => {
  if (DEBUG) {
    console.log(`[FileTree.tsx] ${message}`, ...data);
  }
};

// Convert to forwardRef to allow parent components to access methods
const FileTree = forwardRef<FileTreeHandle, FileTreeProps>((props, ref): JSX.Element => {
  const { files, rootPath, onSelectionChange, onFilesUpdate } = props;
  
  console.log('[FileTree.tsx] Rendering with files:', files.length, 'Root path:', rootPath);
  
  // Path utility
  const pathUtils = {
    basename: (pathString: string) => {
      return pathString.split('/').pop() || pathString;
    },
    dirname: (pathString: string) => {
      if (!pathString.includes('/')) return rootPath;
      return pathString.split('/').slice(0, -1).join('/') || rootPath;
    }
  };
  
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([rootPath]));
  const [loadedDirectories, setLoadedDirectories] = useState<Set<string>>(new Set());
  const [loadingDirectories, setLoadingDirectories] = useState<Set<string>>(new Set());
  
  // Convert FileInfo objects to FlattenedFile objects
  const buildFlattenedTree = (files: FileInfo[], rootPath: string): FlattenedFile[] => {
    console.log('[FileTree.tsx] buildFlattenedTree called with', files.length, 'files');
    
    const result: FlattenedFile[] = [];
    const idMap = new Map<string, FlattenedFile>();
    
    // First pass: create nodes
    files.forEach(file => {
      const relativePath = file.relativePath;
      const level = relativePath.split('/').length - 1;
      const parentPath = level === 0 ? rootPath : pathUtils.dirname(file.path);
      
      const node: FlattenedFile = {
        ...file,
        id: file.path,
        level,
        parentId: parentPath !== file.path ? parentPath : null,
        children: file.isDirectory ? [] : undefined
      };
      
      idMap.set(node.id, node);
      result.push(node);
    });
    
    // Second pass: build tree structure
    result.forEach(node => {
      if (node.parentId) {
        const parent = idMap.get(node.parentId);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      }
    });
    
    return result;
  };
  
  // Selection reducer to handle the tri-state checkboxes
  const selectionReducer = (state: SelectionState, action: SelectionAction): SelectionState => {
    logDebug(`selectionReducer ACTION: ${action.type}`, 'node' in action ? action.node?.id : 'unknown');

    return produce(state, draft => {
      switch (action.type) {
        case 'TOGGLE_NODE': {
          const { node } = action;
          try {
            // Get current state or default to unchecked
            const currentState = draft.nodeStates.get(node.id) || 'unchecked';
            // Toggle state: checked → unchecked, unchecked/indeterminate → checked
            const newState: CheckState = currentState === 'checked' ? 'unchecked' : 'checked';
            
            draft.nodeStates.set(node.id, newState);
            logDebug(`TOGGLE_NODE: Node ${node.id} from ${currentState} to ${newState}`);
          } catch (error) {
            console.error('Error in TOGGLE_NODE action:', error);
          }
          break;
        }
        
        case 'SET_NODE_STATE': {
          const { node, state: newState } = action;
          console.log(`[FileTree.tsx] SET_NODE_STATE: ${node.id} to ${newState}`);
          
          draft.nodeStates.set(node.id, newState);
          break;
        }
        
        case 'SELECT_ALL': {
          console.log('[FileTree.tsx] SELECT_ALL', action.nodes.length, 'nodes');
          
          try {
            // Set all nodes to checked, except directories which will be determined by children
            action.nodes.forEach(node => {
              if (!node.isSkipped) {
                draft.nodeStates.set(node.id, 'checked');
              }
            });
            
            console.log(`[FileTree.tsx] SELECT_ALL completed`);
          } catch (error) {
            console.error('Error in SELECT_ALL action:', error);
          }
          break;
        }
        
        case 'DESELECT_ALL': {
          console.log('[FileTree.tsx] DESELECT_ALL', action.nodes.length, 'nodes');
          
          // Clear all selection states (set to unchecked)
          action.nodes.forEach(node => {
            draft.nodeStates.set(node.id, 'unchecked');
          });
          
          console.log(`[FileTree.tsx] DESELECT_ALL completed`);
          break;
        }
        
        case 'INITIALIZE_STATES': {
          console.log('[FileTree.tsx] INITIALIZE_STATES with', action.initialStates.size, 'states');
          draft.nodeStates = action.initialStates;
          break;
        }
        
        case 'TOGGLE_VISIBLE_NODES': {
          console.log('[FileTree.tsx] TOGGLE_VISIBLE_NODES with', action.nodes.length, 'nodes');
          
          // Count how many non-directory nodes are already checked
          let checkedCount = 0;
          let totalSelectableCount = 0;
          
          action.nodes.forEach(node => {
            if (!node.isDirectory && !node.isSkipped) {
              totalSelectableCount++;
              const state = draft.nodeStates.get(node.id);
              if (state === 'checked') {
                checkedCount++;
              }
            }
          });
          
          // If more than half are checked, deselect all. Otherwise, select all.
          const shouldCheck = checkedCount <= totalSelectableCount / 2;
          
          action.nodes.forEach(node => {
            if (!node.isDirectory && !node.isSkipped) {
              draft.nodeStates.set(node.id, shouldCheck ? 'checked' : 'unchecked');
            }
          });
          
          console.log(`[FileTree.tsx] TOGGLE_VISIBLE_NODES completed, set to ${shouldCheck ? 'checked' : 'unchecked'}`);
          break;
        }
      }
    });
  };
  
  // Initial state: all nodes unchecked
  const [selectionState, dispatchSelection] = useReducer(selectionReducer, {
    nodeStates: new Map<string, CheckState>()
  });
  
  // Build a flattened representation of the file tree
  const memoizedAllNodes = useMemo(() => {
    console.log('[FileTree.tsx] Calculating memoizedAllNodes with', files.length, 'files');
    return buildFlattenedTree(files, rootPath);
  }, [files, rootPath]);
  
  // Filtered list of visible nodes based on expanded state
  const flattenedVisibleNodes = useMemo(() => {
    console.log('[FileTree.tsx] Calculating flattenedVisibleNodes');
    
    // Start with all nodes
    const visibleNodes: FlattenedFile[] = [];
    
    // Function to check if a node should be visible
    const isVisible = (node: FlattenedFile): boolean => {
      if (node.level === 0) return true; // Root-level items are always visible
      
      // Check if all parent directories are expanded
      let current = node;
      let pathToRoot = [current.id];
      
      while (current.parentId) {
        // If we can't find the parent in our list of nodes, the node isn't visible
        const parent = memoizedAllNodes.find(n => n.id === current.parentId);
        if (!parent) return false;
        
        pathToRoot.push(parent.id);
        current = parent;
        
        // If any parent is not expanded, the node isn't visible
        if (parent.parentId !== null && !expandedNodes.has(parent.id)) {
          return false;
        }
      }
      
      return true;
    };
    
    // Filter nodes based on visibility
    memoizedAllNodes.forEach(node => {
      if (isVisible(node)) {
        visibleNodes.push(node);
      }
    });
    
    console.log(`[FileTree.tsx] flattenedVisibleNodes calculated: ${visibleNodes.length} visible out of ${memoizedAllNodes.length} total`);
    return visibleNodes;
  }, [memoizedAllNodes, expandedNodes]);
  
  // Initialize selection state when files change
  useEffect(() => {
    console.log('[FileTree.tsx] Initializing selection state for', memoizedAllNodes.length, 'nodes');
    
    const initialNodeStates = new Map<string, CheckState>();
    memoizedAllNodes.forEach(node => {
      initialNodeStates.set(node.id, 'unchecked');
    });
    
    dispatchSelection({ type: 'INITIALIZE_STATES', initialStates: initialNodeStates });
  }, [memoizedAllNodes]);
  
  // Update App.tsx with selected files whenever selection changes
  useEffect(() => {
    if (onSelectionChange) {
      console.log('[FileTree.tsx] Selection changed, updating App.tsx');
      
      // Collect all selected files (no directories, no skipped files)
      const selectedFiles: FileInfo[] = [];
      
      memoizedAllNodes.forEach(node => {
        const state = selectionState.nodeStates.get(node.id);
        if (state === 'checked' && !node.isDirectory && !node.isSkipped) {
          selectedFiles.push({
            path: node.path,
            relativePath: node.relativePath,
            size: node.size,
            isDirectory: false, // Explicitly mark as file
            isSkipped: false,   // Explicitly mark as not skipped
            tokenEstimate: node.tokenEstimate
          });
        }
      });
      
      console.log(`[FileTree.tsx] Sending ${selectedFiles.length} selected files to App.tsx`);
      console.log('[FileTree.tsx] First few selections:', selectedFiles.slice(0, 3).map(f => 
        ({ path: f.relativePath, size: f.size, tokens: f.tokenEstimate })));
      
      onSelectionChange(selectedFiles);
    }
  }, [selectionState.nodeStates, onSelectionChange, memoizedAllNodes]);
  
  // Expose methods via ref to parent components
  useImperativeHandle(ref, () => ({
    expandAll: () => {
      console.log('[FileTree.tsx] expandAll called');
      const allDirIds = new Set<string>();
      
      memoizedAllNodes.forEach(node => {
        if (node.isDirectory) {
          allDirIds.add(node.id);
        }
      });
      
      setExpandedNodes(allDirIds);
      console.log(`[FileTree.tsx] Expanded ${allDirIds.size} directories`);
    },
    
    collapseAll: () => {
      console.log('[FileTree.tsx] collapseAll called');
      // Keep only root expanded
      setExpandedNodes(new Set([rootPath]));
    },
    
    selectAll: () => {
      console.log('[FileTree.tsx] selectAll called');
      dispatchSelection({ type: 'SELECT_ALL', nodes: memoizedAllNodes });
    },
    
    deselectAll: () => {
      console.log('[FileTree.tsx] deselectAll called');
      dispatchSelection({ type: 'DESELECT_ALL', nodes: memoizedAllNodes });
    }
  }));
  
  // Set up the virtualized list
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: flattenedVisibleNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30, // Estimate row height
    overscan: 10 // Render extra items for smoother scrolling
  });
  
  const virtualItems = virtualizer.getVirtualItems();
  
  // Toggle node expand/collapse
  const toggleNodeExpand = (node: FlattenedFile) => {
    console.log(`[FileTree.tsx] toggleNodeExpand for ${node.id}`);
    
    if (node.isDirectory) {
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(node.id)) {
          console.log(`[FileTree.tsx] Collapsing node ${node.id}`);
          newSet.delete(node.id);
        } else {
          console.log(`[FileTree.tsx] Expanding node ${node.id}`);
          newSet.add(node.id);
        }
        return newSet;
      });
    }
  };
  
  // Toggle node selection
  const toggleNodeSelection = (node: FlattenedFile) => {
    console.log(`[FileTree.tsx] toggleNodeSelection for ${node.id}`);
    dispatchSelection({ type: 'TOGGLE_NODE', node });
  };
  
  // Calculate total selected size
  const selectedData = useMemo(() => {
    let totalSize = 0;
    let count = 0;
    
    memoizedAllNodes.forEach(node => {
      const state = selectionState.nodeStates.get(node.id);
      if (state === 'checked' && !node.isDirectory && !node.isSkipped) {
        totalSize += node.size;
        count++;
      }
    });
    
    console.log(`[FileTree.tsx] Selected data: ${count} files, ${formatFileSize(totalSize)}`);
    return { totalSize, count };
  }, [selectionState.nodeStates, memoizedAllNodes]);
  
  // Render a row for a file or directory
  const renderRow = (index: number, virtualRow: any) => {
    const node = flattenedVisibleNodes[index];
    if (!node) return null;
    
    const nodeState = selectionState.nodeStates.get(node.id) || 'unchecked';
    const isExpanded = node.isDirectory && expandedNodes.has(node.id);
    
    return (
      <div
        className="flex items-center w-full py-1 px-2 hover:bg-gray-700/50 cursor-pointer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: virtualRow.size,
          transform: `translateY(${virtualRow.start}px)`
        }}
        onClick={() => toggleNodeExpand(node)}
        key={node.id}
      >
        <div style={{ paddingLeft: `${node.level * 20}px` }} className="flex items-center min-w-0 flex-grow">
          {node.isDirectory && (
            <ChevronIcon isOpen={isExpanded} />
          )}
          <TriStateCheckbox
            state={nodeState}
            onChange={() => toggleNodeSelection(node)}
          />
          {node.isDirectory ? (
            <FolderIcon isOpen={isExpanded} />
          ) : (
            <FileIcon file={node} />
          )}
          <span className="ml-1.5 truncate">{pathUtils.basename(node.relativePath)}</span>
          {node.isSkipped && <SkipReasonIndicator file={node} />}
        </div>
        {!node.isDirectory && (
          <span className="ml-auto text-xs text-gray-500 tabular-nums">{formatFileSize(node.size)}</span>
        )}
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <div className="flex-1">
          <input
            type="checkbox"
            className="mr-2"
            checked={selectedData.count > 0}
            onChange={() => {
              if (selectedData.count > 0) {
                dispatchSelection({ type: 'DESELECT_ALL', nodes: memoizedAllNodes });
              } else {
                dispatchSelection({ type: 'SELECT_ALL', nodes: memoizedAllNodes });
              }
            }}
          />
          <span>Name</span>
        </div>
        <div className="w-20 text-right">Size</div>
      </div>
      
      <div
        ref={parentRef}
        className="flex-1 overflow-auto border border-gray-700 rounded"
        style={{ height: '400px' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualItems.map(virtualRow => (
            renderRow(virtualRow.index, virtualRow)
          ))}
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-2 text-sm">
        <div>
          <span className="inline-flex items-center">
            <input
              type="checkbox"
              className="mr-2"
              checked={selectedData.count > 0}
              onChange={() => {
                if (selectedData.count > 0) {
                  dispatchSelection({ type: 'TOGGLE_VISIBLE_NODES', nodes: flattenedVisibleNodes });
                } else {
                  dispatchSelection({ type: 'TOGGLE_VISIBLE_NODES', nodes: flattenedVisibleNodes });
                }
              }}
            />
            <span>Expand All</span>
          </span>
          <span className="mx-4">•</span>
          <span>Collapse All</span>
        </div>
        <div>{selectedData.count > 0 ? `${selectedData.count} files, ${formatFileSize(selectedData.totalSize)} selected` : ''}</div>
      </div>
    </div>
  );
});

export default FileTree; 