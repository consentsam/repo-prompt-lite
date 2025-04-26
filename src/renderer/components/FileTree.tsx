import React, { useState, useMemo, useReducer, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { produce, enableMapSet } from 'immer';
import { FileInfo, CheckState, FlattenedFile } from '../types/common';

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

const FileIcon = ({ isSkipped }: { isSkipped: boolean }) => (
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

// Tri-state checkbox component
const TriStateCheckbox = ({ state, onChange }: { state: CheckState, onChange: () => void }) => {
  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
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

interface FileTreeProps {
  files: FileInfo[];
  rootPath: string;
  onSelectionChange?: (selectedFiles: FileInfo[]) => void;
}

// Format file size helper
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Selection reducer types
type SelectionState = {
  nodeStates: Map<string, CheckState>;
};

type SelectionAction = 
  | { type: 'TOGGLE_NODE'; node: FlattenedFile; }
  | { type: 'SET_NODE_STATE'; node: FlattenedFile; state: CheckState; };

export default function FileTree({ 
  files, 
  rootPath,
  onSelectionChange
}: FileTreeProps): JSX.Element {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([rootPath]));
  
  // Store previous selection to prevent unnecessary renders
  const prevSelectionRef = React.useRef<string>('');
  
  // Track last clicked node and time for double-click detection
  const lastClickedRef = React.useRef<{nodeId: string, time: number} | null>(null);
  
  // Track nodes waiting for double-click
  const [doubleClickNodes, setDoubleClickNodes] = useState<Set<string>>(new Set());
  
  // Helper for path manipulation inside the component to access rootPath
  const path = {
    basename: (pathString: string) => {
      return pathString.split('/').pop() || pathString;
    },
    dirname: (pathString: string) => {
      if (!pathString.includes('/')) return rootPath;
      return pathString.split('/').slice(0, -1).join('/') || rootPath;
    }
  };
  
  // Selection reducer to handle the tri-state checkboxes
  const selectionReducer = (state: SelectionState, action: SelectionAction): SelectionState => {
    return produce(state, draft => {
      switch (action.type) {
        case 'TOGGLE_NODE': {
          const node = action.node;
          const currentState = draft.nodeStates.get(node.id) || 'unchecked';
          const newState = currentState === 'checked' ? 'unchecked' : 'checked';
          
          // Update this node's state
          draft.nodeStates.set(node.id, newState);
          
          // Update all children recursively
          const updateChildren = (parent: FlattenedFile) => {
            if (!parent.children) return;
            
            for (const child of parent.children) {
              draft.nodeStates.set(child.id, newState);
              if (child.children) {
                updateChildren(child);
              }
            }
          };
          
          if (node.children) {
            updateChildren(node);
          }
          
          // Update all parents recursively
          const updateParent = (child: FlattenedFile) => {
            if (!child.parent) return;
            
            const parent = child.parent;
            const childrenStates = parent.children
              ? parent.children.map(c => draft.nodeStates.get(c.id) || 'unchecked')
              : [];
            
            // If all children are checked, parent is checked
            // If all children are unchecked, parent is unchecked
            // Otherwise, parent is indeterminate
            if (childrenStates.every(s => s === 'checked')) {
              draft.nodeStates.set(parent.id, 'checked');
            } else if (childrenStates.every(s => s === 'unchecked')) {
              draft.nodeStates.set(parent.id, 'unchecked');
            } else {
              draft.nodeStates.set(parent.id, 'indeterminate');
            }
            
            // Continue up the tree
            updateParent(parent);
          };
          
          updateParent(node);
          break;
        }
        
        case 'SET_NODE_STATE': {
          const node = action.node;
          const newState = action.state;
          
          draft.nodeStates.set(node.id, newState);
          break;
        }
      }
    });
  };
  
  // Initialize selection state
  const [selectionState, dispatchSelection] = useReducer(selectionReducer, {
    nodeStates: new Map<string, CheckState>()
  });
  
  // Build tree structure from flat file list
  const buildTree = useMemo(() => {
    // Map to store all nodes by path
    const nodesMap = new Map<string, FlattenedFile>();
    
    // Root node
    const rootNode: FlattenedFile = {
      id: rootPath,
      path: rootPath,
      relativePath: '',
      size: 0,
      isDirectory: true,
      isSkipped: false,
      tokenEstimate: 0,
      level: 0,
      visible: true,
      isOpen: true,
      children: [],
      checkState: selectionState.nodeStates.get(rootPath) || 'unchecked'
    };
    
    nodesMap.set(rootPath, rootNode);
    
    // Sort files: directories first, then by relative path
    const sortedFiles = [...files].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.relativePath.localeCompare(b.relativePath);
    });
    
    // Build the tree
    for (const file of sortedFiles) {
      const node: FlattenedFile = {
        ...file,
        id: file.path,
        level: file.relativePath.split('/').length,
        visible: expandedNodes.has(path.dirname(file.path)),
        isOpen: file.isDirectory ? expandedNodes.has(file.path) : undefined,
        children: file.isDirectory ? [] : undefined,
        checkState: selectionState.nodeStates.get(file.path) || 'unchecked'
      };
      
      nodesMap.set(file.path, node);
      
      // Find parent directory
      const parentPath = path.dirname(file.path);
      const parent = nodesMap.get(parentPath);
      
      if (parent && parent.children) {
        parent.children.push(node);
        node.parent = parent;
      }
    }
    
    return rootNode;
  }, [files, rootPath, expandedNodes, selectionState.nodeStates]);
  
  // Flatten the tree for virtualization
  const flattenTree = useMemo(() => {
    const flattenedItems: FlattenedFile[] = [];
    
    // Recursive function to flatten the tree
    function flatten(node: FlattenedFile) {
      // Update node's checkState from selection state
      node.checkState = selectionState.nodeStates.get(node.id) || 'unchecked';
      flattenedItems.push(node);
      
      if (node.isOpen && node.children) {
        for (const child of node.children) {
          child.visible = true;
          flatten(child);
        }
      } else if (node.children) {
        // Mark children as not visible
        for (const child of node.children) {
          child.visible = false;
        }
      }
    }
    
    flatten(buildTree);
    
    // Only include visible nodes
    return flattenedItems.filter(item => item.visible);
  }, [buildTree, selectionState.nodeStates]);
  
  // Get selected files when selection changes
  useEffect(() => {
    if (!onSelectionChange) return;
    
    const selectedFiles: FileInfo[] = [];
    
    // Collect all checked files (not directories)
    const collectSelectedFiles = (nodes: FlattenedFile[]) => {
      for (const node of nodes) {
        const state = selectionState.nodeStates.get(node.id) || 'unchecked';
        
        if (!node.isDirectory && state === 'checked' && !node.isSkipped) {
          selectedFiles.push({
            path: node.path,
            relativePath: node.relativePath,
            size: node.size,
            isDirectory: node.isDirectory,
            isSkipped: node.isSkipped,
            tokenEstimate: node.tokenEstimate
          });
        }
        
        if (node.children) {
          collectSelectedFiles(node.children);
        }
      }
    };
    
    if (buildTree.children) {
      collectSelectedFiles(buildTree.children);
    }
    
    // Generate a key for the current selection
    const selectionKey = JSON.stringify(selectedFiles.map(f => f.path).sort());
    
    // Only call onSelectionChange if the selection has actually changed
    if (prevSelectionRef.current !== selectionKey) {
      prevSelectionRef.current = selectionKey;
      onSelectionChange(selectedFiles);
    }
  }, [selectionState.nodeStates, buildTree, onSelectionChange]);
  
  // Create a ref for the parent element
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  // Create the virtualizer
  const rowVirtualizer = useVirtualizer({
    count: flattenTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32, // row height
    overscan: 10,
  });
  
  // Toggle node expansion
  const toggleNode = (node: FlattenedFile) => {
    if (!node.isDirectory) return;
    
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(node.path)) {
        newSet.delete(node.path);
      } else {
        newSet.add(node.path);
      }
      return newSet;
    });
  };
  
  // Toggle selection of a node
  const toggleSelection = (node: FlattenedFile) => {
    // Special handling for binary/skipped files - require double click
    if (!node.isDirectory && node.isSkipped) {
      const now = Date.now();
      const lastClicked = lastClickedRef.current;
      
      if (lastClicked && lastClicked.nodeId === node.id && now - lastClicked.time < 500) {
        // Double click detected, allow selection
        dispatchSelection({ type: 'TOGGLE_NODE', node });
        lastClickedRef.current = null; // Reset after double click
        
        // Remove from double-click pending set
        setDoubleClickNodes(prev => {
          const updated = new Set(prev);
          updated.delete(node.id);
          return updated;
        });
      } else {
        // First click, just record it
        lastClickedRef.current = { nodeId: node.id, time: now };
        
        // Add to double-click pending set
        setDoubleClickNodes(prev => {
          const updated = new Set(prev);
          updated.add(node.id);
          return updated;
        });
        
        // Auto-clear message after 2 seconds
        setTimeout(() => {
          setDoubleClickNodes(prev => {
            const updated = new Set(prev);
            updated.delete(node.id);
            return updated;
          });
        }, 2000);
      }
    } else {
      // Normal files and directories - single click is enough
      dispatchSelection({ type: 'TOGGLE_NODE', node });
    }
  };
  
  // Get the indentation based on level
  const getIndent = (level: number) => {
    return `${level * 20}px`;
  };
  
  return (
    <div className="w-full mt-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-200">File Explorer</h2>
      
      <div 
        ref={parentRef}
        className="w-full h-96 overflow-auto bg-gray-800 rounded-lg border border-gray-700"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const file = flattenTree[virtualRow.index];
            
            const needsDoubleClick = !file.isDirectory && file.isSkipped && doubleClickNodes.has(file.id);
            
            return (
              <div
                key={file.id}
                className={clsx(
                  "absolute top-0 left-0 w-full flex items-center py-1.5 px-3 hover:bg-gray-700/50 select-none cursor-pointer",
                  file.isDirectory && "font-medium"
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => toggleNode(file)}
              >
                <div style={{ paddingLeft: getIndent(file.level) }} className="flex items-center overflow-hidden w-full">
                  <TriStateCheckbox 
                    state={file.checkState} 
                    onChange={() => toggleSelection(file)} 
                  />
                  
                  {file.isDirectory ? (
                    <FolderIcon isOpen={!!file.isOpen} />
                  ) : (
                    <FileIcon isSkipped={file.isSkipped} />
                  )}
                  
                  <span 
                    className={clsx(
                      "truncate",
                      file.isDirectory ? "text-gray-200" : file.isSkipped ? "text-gray-500" : "text-gray-300"
                    )}
                  >
                    {file.relativePath === '' 
                      ? path.basename(file.path)
                      : path.basename(file.relativePath)}
                  </span>
                  
                  {!file.isDirectory && (
                    <span className="ml-2 text-xs text-gray-500">
                      {formatFileSize(file.size)}
                      {!file.isSkipped && file.tokenEstimate > 0 && ` • ${file.tokenEstimate.toLocaleString()} tokens`}
                    </span>
                  )}
                  
                  {needsDoubleClick && (
                    <span className="ml-2 text-xs text-amber-400">
                      Double-click to select
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 