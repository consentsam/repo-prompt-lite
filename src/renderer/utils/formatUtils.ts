/**
 * Utilities for formatting file tree structures
 */
import { FileInfo } from '../types/common';
import { formatFileSize } from './selectionUtils';

interface TreeNode {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  isSkipped: boolean;
  isSelected?: boolean;
  size: number;
  tokenEstimate: number;
  children: TreeNode[];
}

/**
 * Tree formatting options
 */
export interface TreeFormatOptions {
  showSizes?: boolean;      // Show file sizes
  showTokens?: boolean;     // Show token estimates
  showBinary?: boolean;     // Show binary files as [binary]
  highlightSelected?: boolean; // Add a visual marker for selected files
  sortDirectoriesFirst?: boolean; // Sort directories before files
  sortBy?: 'name' | 'size' | 'tokens'; // Sort method
  sortDirection?: 'asc' | 'desc'; // Sort direction
  showOnlySelected?: boolean; // Only show selected files and their parent directories
  maxDepth?: number; // Maximum depth to render (undefined = unlimited)
}

// Default tree formatting options
const DEFAULT_OPTIONS: TreeFormatOptions = {
  showSizes: false,
  showTokens: false,
  showBinary: true,
  highlightSelected: true,
  sortDirectoriesFirst: true,
  sortBy: 'name',
  sortDirection: 'asc',
  showOnlySelected: false,
  maxDepth: undefined
};

/**
 * Build a tree structure from a flat list of files
 */
function buildFileTree(files: FileInfo[], selectedFiles: FileInfo[] = [], options: TreeFormatOptions = {}): TreeNode {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const root: TreeNode = {
    name: 'root',
    relativePath: '',
    isDirectory: true,
    isSkipped: false,
    isSelected: false,
    size: 0,
    tokenEstimate: 0,
    children: []
  };
  
  // Create a set of selected file paths for quick lookup
  const selectedPathsSet = new Set(selectedFiles.map(file => file.path));
  
  // First, sort the files to ensure directories are processed before their children
  let sortedFiles = [...files].sort((a, b) => 
    a.relativePath.split('/').length - b.relativePath.split('/').length
  );
  
  // Build a map of all nodes by path for quick lookup
  const nodeMap = new Map<string, TreeNode>();
  nodeMap.set('', root);
  
  // Process each file
  for (const file of sortedFiles) {
    const pathParts = file.relativePath.split('/');
    const fileName = pathParts.pop() || '';
    const parentPath = pathParts.join('/');
    
    // Get or create parent node
    let parentNode = nodeMap.get(parentPath);
    if (!parentNode) {
      // This shouldn't happen if files are properly sorted by depth
      console.warn(`Parent node not found for ${file.relativePath}`);
      continue;
    }
    
    // If we're only showing selected files and this isn't selected, 
    // only add directories as they might be parents of selected files
    if (opts.showOnlySelected && !selectedPathsSet.has(file.path) && !file.isDirectory) {
      continue;
    }
    
    // Create node for this file/directory
    const isSelected = selectedPathsSet.has(file.path);
    const node: TreeNode = {
      name: fileName,
      relativePath: file.relativePath,
      isDirectory: file.isDirectory,
      isSkipped: file.isSkipped,
      isSelected,
      size: file.size,
      tokenEstimate: file.tokenEstimate,
      children: []
    };
    
    // Add to parent's children
    parentNode.children.push(node);
    
    // Add to map if it's a directory
    if (file.isDirectory) {
      nodeMap.set(file.relativePath, node);
    }
  }
  
  // Apply sorting to each level of the tree
  const sortNodes = (nodes: TreeNode[]) => {
    // Sort the nodes
    nodes.sort((a, b) => {
      // Directories first if the option is enabled
      if (opts.sortDirectoriesFirst) {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
      }
      
      // Sort by the specified property
      let comparison = 0;
      switch (opts.sortBy) {
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'tokens':
          comparison = a.tokenEstimate - b.tokenEstimate;
          break;
        case 'name':
        default:
          comparison = a.name.localeCompare(b.name);
          break;
      }
      
      // Apply sort direction
      return opts.sortDirection === 'desc' ? -comparison : comparison;
    });
    
    // Sort children recursively
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    }
  };
  
  // Sort the entire tree
  sortNodes(root.children);
  
  // Calculate directory sizes and token counts
  const calculateStats = (node: TreeNode): { size: number; tokens: number } => {
    if (!node.isDirectory || node.children.length === 0) {
      return { size: node.size, tokens: node.tokenEstimate };
    }
    
    let totalSize = 0;
    let totalTokens = 0;
    
    for (const child of node.children) {
      const stats = calculateStats(child);
      totalSize += stats.size;
      totalTokens += stats.tokens;
    }
    
    node.size = totalSize;
    node.tokenEstimate = totalTokens;
    
    return { size: totalSize, tokens: totalTokens };
  };
  
  // Update the sizes and token estimates for directories
  calculateStats(root);
  
  // Mark parent directories of selected files as "containing selected files"
  if (opts.highlightSelected) {
    const markParents = (node: TreeNode): boolean => {
      if (node.isSelected) return true;
      
      let hasSelectedChildren = false;
      for (const child of node.children) {
        if (markParents(child)) {
          hasSelectedChildren = true;
        }
      }
      
      // If this directory contains selected files, mark it
      if (hasSelectedChildren && node.isDirectory) {
        node.isSelected = true;
      }
      
      return hasSelectedChildren;
    };
    
    markParents(root);
  }
  
  // Prune empty directories if only showing selected
  if (opts.showOnlySelected) {
    const pruneEmptyDirs = (node: TreeNode): boolean => {
      // If it's a file, keep it if selected
      if (!node.isDirectory) {
        return node.isSelected || false;
      }
      
      // For directories, remove children that should be pruned
      const keepChildren: TreeNode[] = [];
      for (const child of node.children) {
        if (pruneEmptyDirs(child)) {
          keepChildren.push(child);
        }
      }
      
      node.children = keepChildren;
      
      // Keep this directory if it has children or is selected itself
      return node.children.length > 0 || node.isSelected || false;
    };
    
    pruneEmptyDirs(root);
  }
  
  return root;
}

/**
 * Format a tree node as an ASCII tree string
 */
function formatTreeNode(
  node: TreeNode, 
  prefix: string = '', 
  isLast: boolean = true, 
  options: TreeFormatOptions = {},
  depth: number = 0
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Skip the root node itself
  if (node.name === 'root') {
    return node.children.map((child, i) => 
      formatTreeNode(child, '', i === node.children.length - 1, opts, depth + 1)
    ).join('');
  }
  
  // Check max depth
  if (opts.maxDepth !== undefined && depth > opts.maxDepth) {
    // If we're at max depth, just indicate that there are more items
    if (depth === opts.maxDepth + 1 && node.isDirectory && node.children.length > 0) {
      return `${prefix}${isLast ? '└── ' : '├── '}...\n`;
    }
    return '';
  }
  
  let result = prefix;
  
  // Add the appropriate prefix characters
  if (node.name !== 'root') {
    result += isLast ? '└── ' : '├── ';
  }
  
  // Add the node name with proper formatting
  let nodeName = node.name;
  
  // Format directories with a trailing slash
  if (node.isDirectory) {
    nodeName += '/';
  }
  
  // Format binary files if option is enabled
  if (opts.showBinary && !node.isDirectory && node.isSkipped) {
    nodeName += ' [binary]';
  }
  
  // Highlight selected files if option is enabled
  if (opts.highlightSelected && node.isSelected) {
    // Don't actually add markers in the output - this is just for clarity in docs
    // nodeName += ' [selected]';
  }
  
  // Add the node name
  result += nodeName;
  
  // Add size if option is enabled
  if (opts.showSizes && !node.isDirectory) {
    result += ` (${formatFileSize(node.size)})`;
  }
  
  // Add token count if option is enabled
  if (opts.showTokens && !node.isDirectory && !node.isSkipped) {
    const tokenStr = opts.showSizes ? `, ${node.tokenEstimate} tokens` : ` (${node.tokenEstimate} tokens)`;
    result += tokenStr;
  }
  
  // End the line
  result += '\n';
  
  // Recursively format child nodes
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  
  node.children.forEach((child, i) => {
    result += formatTreeNode(
      child,
      childPrefix,
      i === node.children.length - 1,
      opts,
      depth + 1
    );
  });
  
  return result;
}

/**
 * Generate a <file_map> ASCII tree structure for selected files
 * @param selectedFiles Files that are selected
 * @param rootFolderName Optional root folder name
 * @param allFiles All files in the repository (if not provided, uses selectedFiles)
 * @param options Tree formatting options
 */
export function generateFileMap(
  selectedFiles: FileInfo[], 
  rootFolderName?: string,
  allFiles?: FileInfo[],
  options: TreeFormatOptions = {}
): string {
  // Merge default options with provided options
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Convert flat file list to tree structure
  const fileTree = buildFileTree(allFiles || selectedFiles, selectedFiles, opts);
  
  // Set the root node name if provided
  if (rootFolderName) {
    fileTree.name = rootFolderName;
  }
  
  // Format the tree
  const treeString = formatTreeNode(fileTree, '', true, opts);
  
  // Return the formatted tree
  return treeString;
}

/**
 * Generate the full payload for clipboard copying
 */
export function generateClipboardPayload(
  selectedFiles: FileInfo[],
  rootFolderName?: string,
  allFiles?: FileInfo[],
  options: TreeFormatOptions = {}
): string {
  const fileMap = generateFileMap(selectedFiles, rootFolderName, allFiles, options);
  
  return `<file_map>\n${fileMap}</file_map>`;
} 