import React, { useState, useMemo, useReducer, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { produce, enableMapSet } from 'immer';
import { FileInfo, CheckState, FlattenedFile } from '../types/common';
import { flattenSelection, formatFileSize as formatFileSizeUtil } from '../utils/selectionUtils';

// Enable Immer's MapSet plugin to work with Map and Set
enableMapSet();

// Add this helper near the top of the file
const DEBUG = true;
const logDebug = (message: string, ...data: any[]) => {
  if (DEBUG) {
    console.log(`[FileTree.tsx] ${message}`, ...data);
  }
};

// Helper to get direct children of a node
const getDirectChildren = (nodeId: string | null, allNodes: FlattenedFile[]): FlattenedFile[] => {
  if (nodeId === null) { 
    return allNodes.filter(n => n.parentId === null);
  }
  return allNodes.filter(n => n.parentId === nodeId);
};

// Helper to get all descendants (recursive)
const getAllDescendants = (nodeId: string, allNodes: FlattenedFile[]): FlattenedFile[] => {
  const descendants: FlattenedFile[] = [];
  const directChildren = getDirectChildren(nodeId, allNodes);
  for (const child of directChildren) {
    if (!child.isSkipped) { // Only consider non-skipped descendants for state changes
      descendants.push(child);
      if (child.isDirectory) {
        descendants.push(...getAllDescendants(child.id, allNodes));
      }
    }
  }
  return descendants;
};

// Helper to update parent states recursively
const updateParentStatesAfterToggle = (
  startNodeId: string | null,
  draftNodeStates: Map<string, CheckState>,
  allNodes: FlattenedFile[],
  logPrefix: string = 'updateParentStatesAfterToggle'
) => {
  let currentId = startNodeId;
  logDebug(`[${logPrefix}] Starting update from parent:`, currentId);

  while (currentId) {
    const currentNode = allNodes.find(n => n.id === currentId);
    if (!currentNode) {
      logDebug(`[${logPrefix}] Parent ${currentId} not found in allNodes. Stopping upward propagation.`);
      break;
    }
    if (!currentNode.isDirectory) {
      logDebug(`[${logPrefix}] Parent ${currentId} is not a directory. Stopping upward propagation.`);
      break; 
    }

    const children = getDirectChildren(currentNode.id, allNodes);
    if (children.length === 0) {
      logDebug(`[${logPrefix}] Parent ${currentNode.id} has no children. Current state:`, draftNodeStates.get(currentNode.id));
      currentId = currentNode.parentId;
      continue;
    }

    let checkedChildrenCount = 0;
    let indeterminateChildrenCount = 0;
    let nonSkippedSelectableChildrenCount = 0;

    for (const child of children) {
      if (child.isSkipped) continue;
      nonSkippedSelectableChildrenCount++;
      const childState = draftNodeStates.get(child.id);
      if (childState === 'checked') {
        checkedChildrenCount++;
      } else if (childState === 'indeterminate') {
        indeterminateChildrenCount++;
      }
    }
    
    const oldParentState = draftNodeStates.get(currentNode.id);
    let newParentState: CheckState = 'unchecked';

    if (nonSkippedSelectableChildrenCount === 0) {
      newParentState = oldParentState || 'unchecked'; 
    } else if (indeterminateChildrenCount > 0) {
      newParentState = 'indeterminate';
    } else if (checkedChildrenCount === nonSkippedSelectableChildrenCount) {
      newParentState = 'checked';
    } else if (checkedChildrenCount > 0 && checkedChildrenCount < nonSkippedSelectableChildrenCount) {
      newParentState = 'indeterminate';
    } else { 
      newParentState = 'unchecked';
    }
    
    if (oldParentState !== newParentState) {
        draftNodeStates.set(currentNode.id, newParentState);
        logDebug(`[${logPrefix}] Parent ${currentNode.id} state changed from ${oldParentState} to ${newParentState}`);
    } else {
        logDebug(`[${logPrefix}] Parent ${currentNode.id} state remains ${oldParentState}`);
    }
    
    currentId = currentNode.parentId;
  }
  logDebug(`[${logPrefix}] Finished update.`);
};

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
const TriStateCheckbox = ({ 
  state, 
  onChange, 
  isDisabled // New prop
}: { 
  state: CheckState, 
  onChange: () => void, 
  isDisabled?: boolean // Optional boolean prop
}) => {
  // console.log('[TriStateCheckbox] Rendered with state:', state, 'Disabled:', isDisabled);
  return (
    <button 
      onClick={(e) => {
        e.stopPropagation(); // Prevent row click
        if (isDisabled) {
          logDebug('[TriStateCheckbox] Clicked but disabled for state:', state);
          return; // Prevent action if disabled
        }
        logDebug('[TriStateCheckbox] Clicked with state:', state);
        onChange();
      }}
      className={clsx(
        "w-5 h-5 mr-2 flex items-center justify-center rounded border",
        state === 'checked' && !isDisabled
          ? "bg-blue-600 border-blue-700" 
          : state === 'indeterminate' && !isDisabled
            ? "bg-blue-600/50 border-blue-700" 
            : "bg-gray-800 border-gray-600", // Default/unchecked or disabled style base
        isDisabled && "opacity-50 cursor-not-allowed border-gray-700 bg-gray-800" // Specific styling for disabled state
      )}
      disabled={isDisabled} // HTML disabled attribute
      aria-disabled={isDisabled} // ARIA attribute for accessibility
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
      if (!pathString.includes('/')) return ''; // Return empty string for top-level relative paths
      return pathString.split('/').slice(0, -1).join('/');
    }
  };
  
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set<string>()); // Initialize as empty
  const [loadedDirectories, setLoadedDirectories] = useState<Set<string>>(new Set());
  const [loadingDirectories, setLoadingDirectories] = useState<Set<string>>(new Set());
  
  // Convert FileInfo objects to FlattenedFile objects
  const buildFlattenedTree = (filesToFlatten: FileInfo[], _currentRootPathIgnored: string): FlattenedFile[] => {
    logDebug('[FileTree.tsx] buildFlattenedTree called with', filesToFlatten.length, 'files.');
    const result: FlattenedFile[] = [];
    
    // Sort files by relativePath to ensure consistent order (parents usually before children)
    const sortedFiles = [...filesToFlatten].sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    for (const file of sortedFiles) {
      const pathSegments = file.relativePath.split('/');
      const level = Math.max(0, pathSegments.length - 1);
      const name = pathSegments[pathSegments.length - 1] || file.relativePath; // Use relativePath if name is empty (e.g. root folder if it was a node)

      let parentId: string | null = null;
      if (pathSegments.length > 1) {
        parentId = pathSegments.slice(0, -1).join('/');
      }

      result.push({
        id: file.relativePath, // Use relativePath as the unique ID for nodes
        parentId: parentId,
        path: file.path, // Absolute path
        relativePath: file.relativePath,
        name: name,
        level: level,
        isDirectory: file.isDirectory,
        isSkipped: file.isSkipped,
        skipReason: file.skipReason,
        size: file.size,
        tokenEstimate: file.tokenEstimate,
        hasLazyChildren: file.hasLazyChildren,
        // isExpanded and checkState will be managed by component state/reducer elsewhere
      });
    }
    logDebug('[FileTree.tsx] buildFlattenedTree produced', result.length, 'nodes.');
    return result;
  };

  // Memoize the flattened tree structure
  const flattenedNodes = useMemo(() => {
    logDebug('[FileTree.tsx] Memoizing flattenedNodes. Files count:', files.length, 'Root path:', rootPath);
    if (!files || files.length === 0) {
      logDebug('[FileTree.tsx] No files to process for flattening.');
      return [];
    }
    return buildFlattenedTree(files, rootPath);
  }, [files, rootPath]);
  
  // Selection reducer to handle the tri-state checkboxes
  const selectionReducer = (state: SelectionState, action: SelectionAction): SelectionState => {
    return produce(state, draft => {
      logDebug(`selectionReducer ACTION: ${action.type}`, 'node' in action && action.node ? action.node.id : ('nodes' in action ? action.nodes.length + ' nodes' : 'initialStates' in action ? action.initialStates.size + ' states' : 'unknown target'));
      
      const currentFlattenedNodes = flattenedNodes; 

      switch (action.type) {
        case 'TOGGLE_NODE': {
          const { node } = action;
          if (!node || node.isSkipped) {
            logDebug(`TOGGLE_NODE: Node ${node?.id} is skipped or null, no state change.`);
            break;
          }

          const currentState = draft.nodeStates.get(node.id) || 'unchecked';
          const newState: CheckState = currentState === 'checked' ? 'unchecked' : 'checked';
          
          logDebug(`TOGGLE_NODE: Node ${node.id} (${node.name}) from ${currentState} to ${newState}`);
          draft.nodeStates.set(node.id, newState);

          if (node.isDirectory) {
            const descendants = getAllDescendants(node.id, currentFlattenedNodes);
            logDebug(`TOGGLE_NODE: Propagating to ${descendants.length} descendants of ${node.id}`);
            descendants.forEach(descendant => {
              // Do not change state of already skipped descendants during cascade
              if (!descendant.isSkipped) {
                 draft.nodeStates.set(descendant.id, newState);
              }
            });
          }
          updateParentStatesAfterToggle(node.parentId, draft.nodeStates, currentFlattenedNodes, 'TOGGLE_NODE_PARENTS');
          break;
        }
        
        case 'SET_NODE_STATE': { 
          const { node, state: newState } = action;
          if (!node || node.isSkipped) break;

          const oldState = draft.nodeStates.get(node.id);
          if (oldState !== newState) {
            draft.nodeStates.set(node.id, newState);
            logDebug(`SET_NODE_STATE: Node ${node.id} state explicitly set to ${newState}`);
            if (node.isDirectory) {
              const descendants = getAllDescendants(node.id, currentFlattenedNodes);
              descendants.forEach(descendant => {
                if (!descendant.isSkipped) {
                  draft.nodeStates.set(descendant.id, newState);
                }
              });
            }
            updateParentStatesAfterToggle(node.parentId, draft.nodeStates, currentFlattenedNodes, 'SET_NODE_STATE_PARENTS');
          }
          break;
        }
        
        case 'SELECT_ALL': {          
          const parentIdsToUpdate = new Set<string | null>();
          currentFlattenedNodes.forEach(node => {
            if (!node.isSkipped) {
              draft.nodeStates.set(node.id, 'checked');
              // Collect parent IDs of checked nodes to update them after all nodes are set
              if (node.parentId) {
                parentIdsToUpdate.add(node.parentId);
              }
            } else {
              draft.nodeStates.set(node.id, 'unchecked');
            }
          });
          // Update all affected parent directories once. 
          // Start from the top-level parents or all unique parents found.
          // A simpler approach for SELECT_ALL is that all non-skipped directories will become 'checked' 
          // because all their non-skipped children are now checked.
          // So, direct setting is enough.
          currentFlattenedNodes.forEach(node => {
            if (node.isDirectory && !node.isSkipped) {
                // Check if it has any non-skipped children, if not, it remains as set (checked if it was selectable)
                const children = getDirectChildren(node.id, currentFlattenedNodes).filter(c => !c.isSkipped);
                if (children.length > 0) {
                    draft.nodeStates.set(node.id, 'checked');
                } else if (draft.nodeStates.get(node.id) !== 'checked') {
                    // If it has no non-skipped children, and wasn't already checked (e.g. top level selection)
                    // it should not be forced to checked. Keep it as it is, or uncheck it.
                    // For SELECT_ALL, if it's selectable (not skipped), it becomes checked.
                    // The previous loop handles this.
                }
            }
          });
          logDebug('[FileTree.tsx] SELECT_ALL completed. All selectable nodes set to checked.');
          break;
        }
        
        case 'DESELECT_ALL': {
          currentFlattenedNodes.forEach(node => {
            draft.nodeStates.set(node.id, 'unchecked');
          });
          logDebug('[FileTree.tsx] DESELECT_ALL completed. All nodes set to unchecked.');
          break;
        }
        
        case 'INITIALIZE_STATES': {
          draft.nodeStates = new Map(action.initialStates); // Ensure it's a new map for Immer
          const parentIdsToUpdate = new Set<string | null>();
          currentFlattenedNodes.forEach(node => { // Iterate all nodes to find parents that might need updates
            if (action.initialStates.has(node.id) && node.parentId) {
              parentIdsToUpdate.add(node.parentId);
            }
          });
          // Also add parents of any initially checked/indeterminate directories themselves
          action.initialStates.forEach((state, nodeId) => {
            if (state === 'checked' || state === 'indeterminate') {
              const n = currentFlattenedNodes.find(fn => fn.id === nodeId);
              if (n && n.isDirectory && n.parentId) {
                parentIdsToUpdate.add(n.parentId);
              }
            }
          });

          parentIdsToUpdate.forEach(parentId => {
            if (parentId) { // Ensure parentId is not null
              updateParentStatesAfterToggle(parentId, draft.nodeStates, currentFlattenedNodes, 'INITIALIZE_PARENTS');
            }
          });
          logDebug('[FileTree.tsx] INITIALIZE_STATES completed and parents updated if necessary');
          break;
        }
        
        case 'TOGGLE_VISIBLE_NODES': { 
          let checkedCount = 0;
          const visibleFileNodes = action.nodes.filter(n => !n.isDirectory && !n.isSkipped);
          let totalSelectableCount = visibleFileNodes.length;

          visibleFileNodes.forEach(node => {
            if (draft.nodeStates.get(node.id) === 'checked') {
              checkedCount++;
            }
          });
          
          const shouldCheck = totalSelectableCount > 0 && checkedCount <= totalSelectableCount / 2;
          const parentIdsToUpdate = new Set<string | null>();

          visibleFileNodes.forEach(node => {
            draft.nodeStates.set(node.id, shouldCheck ? 'checked' : 'unchecked');
            if (node.parentId) parentIdsToUpdate.add(node.parentId);
          });
          
          // For directories among action.nodes (e.g. the header row if it represents root)
          // their state should also be toggled, and then their parents updated.
          action.nodes.forEach(node => {
            if (node.isDirectory && !node.isSkipped) {
              draft.nodeStates.set(node.id, shouldCheck ? 'checked' : 'unchecked');
              // And propagate to its children
              const descendants = getAllDescendants(node.id, currentFlattenedNodes);
              descendants.forEach(descendant => {
                if(!descendant.isSkipped) draft.nodeStates.set(descendant.id, shouldCheck ? 'checked' : 'unchecked');
              });
              if (node.parentId) parentIdsToUpdate.add(node.parentId);
            }
          });

          parentIdsToUpdate.forEach(parentId => {
             if (parentId) { // Ensure parentId is not null
              updateParentStatesAfterToggle(parentId, draft.nodeStates, currentFlattenedNodes, 'TOGGLE_VISIBLE_PARENTS');
            }
          });
          logDebug(`[FileTree.tsx] TOGGLE_VISIBLE_NODES completed, set to ${shouldCheck ? 'checked' : 'unchecked'} and parents updated`);
          break;
        }
      }
    });
  };
  
  // Initial state: all nodes unchecked
  const [selectionState, dispatchSelection] = useReducer(selectionReducer, {
    nodeStates: new Map<string, CheckState>()
  });
  
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
        const parent = flattenedNodes.find(n => n.id === current.parentId);
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
    flattenedNodes.forEach(node => {
      if (isVisible(node)) {
        visibleNodes.push(node);
      }
    });
    
    console.log(`[FileTree.tsx] flattenedVisibleNodes calculated: ${visibleNodes.length} visible out of ${flattenedNodes.length} total`);
    return visibleNodes;
  }, [flattenedNodes, expandedNodes]);
  
  // Initialize selection state when files change
  useEffect(() => {
    console.log('[FileTree.tsx] Initializing selection state for', flattenedNodes.length, 'nodes');
    
    const initialNodeStates = new Map<string, CheckState>();
    flattenedNodes.forEach(node => {
      initialNodeStates.set(node.id, 'unchecked');
    });
    
    dispatchSelection({ type: 'INITIALIZE_STATES', initialStates: initialNodeStates });
  }, [flattenedNodes]);
  
  // Update App.tsx with selected files whenever selection changes
  useEffect(() => {
    if (onSelectionChange) {
      console.log('[FileTree.tsx] Selection changed, updating App.tsx');
      
      // Collect all selected files (no directories, no skipped files)
      const selectedFiles: FileInfo[] = [];
      
      flattenedNodes.forEach(node => {
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
  }, [selectionState.nodeStates, onSelectionChange, flattenedNodes]);
  
  // Expose methods via ref to parent components
  useImperativeHandle(ref, () => ({
    expandAll: () => {
      console.log('[FileTree.tsx] expandAll called');
      const allDirIds = new Set<string>();
      flattenedNodes.forEach(node => {
        if (node.isDirectory) {
          allDirIds.add(node.id);
        }
      });
      setExpandedNodes(allDirIds);
      console.log(`[FileTree.tsx] Expanded ${allDirIds.size} directories`);
    },
    collapseAll: () => {
      console.log('[FileTree.tsx] collapseAll called');
      setExpandedNodes(new Set<string>()); // Collapse all by setting to an empty set
    },
    selectAll: () => {
      console.log('[FileTree.tsx] selectAll called');
      dispatchSelection({ type: 'SELECT_ALL', nodes: flattenedNodes });
    },
    deselectAll: () => {
      console.log('[FileTree.tsx] deselectAll called');
      dispatchSelection({ type: 'DESELECT_ALL', nodes: flattenedNodes });
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
    
    flattenedNodes.forEach(node => {
      const state = selectionState.nodeStates.get(node.id);
      if (state === 'checked' && !node.isDirectory && !node.isSkipped) {
        totalSize += node.size;
        count++;
      }
    });
    
    console.log(`[FileTree.tsx] Selected data: ${count} files, ${formatFileSize(totalSize)}`);
    return { totalSize, count };
  }, [selectionState.nodeStates, flattenedNodes]);
  
  // Render a row for a file or directory
  const renderRow = (index: number, virtualRow: any) => {
    const node = flattenedVisibleNodes[index];

    if (!node) {
      return <div key={virtualRow.key} style={{ height: `${virtualRow.size}px` }} />;
    }
    
    const nodeState = selectionState.nodeStates.get(node.relativePath) || 'unchecked';
    const isExpanded = node.isDirectory && expandedNodes.has(node.relativePath);

    // Main click handler for the entire row
    const handleRowClick = () => {
      logDebug('[FileTree.tsx] Row clicked:', node.relativePath, 'Is directory:', node.isDirectory);
      if (node.isDirectory) {
        // For directories, clicking anywhere on the row (except checkbox/chevron) toggles expansion
        toggleNodeExpand(node);
      } else {
        // For files, clicking anywhere on the row (except checkbox) toggles selection
        toggleNodeSelection(node);
      }
    };
    
    return (
      <div
        key={node.relativePath}
        ref={virtualRow.measureElement}
        data-index={virtualRow.index}
        className={clsx(
          "flex items-center p-1.5 hover:bg-gray-700 cursor-pointer select-none",
        )}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
          paddingLeft: `${node.level * 20 + 5}px`,
        }}
        onClick={handleRowClick}
        onDoubleClick={() => {
          if (node.isDirectory) {
            toggleNodeExpand(node);
          }
        }}
        role="treeitem"
        aria-expanded={node.isDirectory ? isExpanded : undefined}
        aria-selected={nodeState === 'checked' || nodeState === 'indeterminate'}
        aria-level={node.level + 1}
        aria-label={`${node.name}${node.isDirectory ? ' (directory)' : ' (file)'}`}
      >
        <div className="flex items-center flex-grow min-w-0">
          {node.isDirectory && (
            <button 
              onClick={(e) => {
                e.stopPropagation(); // IMPORTANT: Prevent row click when chevron is clicked
                toggleNodeExpand(node);
              }}
              className="mr-1 p-0.5 rounded hover:bg-gray-600"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
            <ChevronIcon isOpen={isExpanded} />
            </button>
          )}
          
          <TriStateCheckbox
            state={nodeState}
            onChange={() => {
              // This already has stopPropagation in its own implementation
              logDebug('[FileTree.tsx] Checkbox changed for:', node.relativePath);
              toggleNodeSelection(node);
            }}
          />

          {node.isDirectory 
            ? <FolderIcon isOpen={isExpanded} /> 
            : <FileIcon file={node} />}
            
          <span 
            className={clsx("ml-1 truncate", {
              "text-gray-400": node.isSkipped && node.skipReason !== 'error' && node.skipReason !== 'size',
              "text-yellow-500": node.isSkipped && (node.skipReason === 'extension' || node.skipReason === 'content'),
              "text-red-500": node.isSkipped && (node.skipReason === 'size' || node.skipReason === 'error'),
            })}
            title={node.relativePath}
          >
            {node.name}
          </span>
          {node.tokenEstimate !== undefined && (
            <span className="ml-2 text-xs text-gray-500">
              ({node.tokenEstimate} tokens)
            </span>
          )}
          <SkipReasonIndicator file={node} />
        </div>
        {!node.isDirectory && node.size !== undefined && (
          <span className="ml-auto text-sm text-gray-500 pr-2">
            {formatFileSize(node.size)}
          </span>
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
                dispatchSelection({ type: 'DESELECT_ALL', nodes: flattenedNodes });
              } else {
                dispatchSelection({ type: 'SELECT_ALL', nodes: flattenedNodes });
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