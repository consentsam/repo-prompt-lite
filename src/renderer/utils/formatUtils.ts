/**
 * Utilities for formatting file tree structures
 */
import { FileInfo } from '../types/common';

interface TreeNode {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  isSkipped: boolean;
  isSelected?: boolean;
  children: TreeNode[];
}

/**
 * Build a tree structure from a flat list of files
 */
function buildFileTree(files: FileInfo[], selectedFiles: FileInfo[] = []): TreeNode {
  const root: TreeNode = {
    name: 'root',
    relativePath: '',
    isDirectory: true,
    isSkipped: false,
    isSelected: false,
    children: []
  };
  
  // Create a set of selected file paths for quick lookup
  const selectedPathsSet = new Set(selectedFiles.map(file => file.path));
  
  // First, sort the files to ensure directories are processed before their children
  const sortedFiles = [...files].sort((a, b) => 
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
    
    // Create node for this file/directory
    const isSelected = selectedPathsSet.has(file.path);
    const node: TreeNode = {
      name: fileName,
      relativePath: file.relativePath,
      isDirectory: file.isDirectory,
      isSkipped: file.isSkipped,
      isSelected,
      children: []
    };
    
    // Add to parent's children
    parentNode.children.push(node);
    
    // Add to map if it's a directory
    if (file.isDirectory) {
      nodeMap.set(file.relativePath, node);
    }
  }
  
  return root;
}

/**
 * Format a tree node as an ASCII tree string
 */
function formatTreeNode(node: TreeNode, prefix: string = '', isLast: boolean = true): string {
  // Skip the root node itself
  if (node.name === 'root') {
    return node.children.map((child, i) => 
      formatTreeNode(child, '', i === node.children.length - 1)
    ).join('');
  }
  
  let result = prefix;
  
  // Add the appropriate prefix characters
  if (node.name !== 'root') {
    result += isLast ? '└── ' : '├── ';
  }
  
  // Add the node name with proper formatting
  let nodeName = node.name;
  if (node.isDirectory) {
    nodeName += '/';
  }
  
  // Highlight selected files - don't add any special marker as that's not needed in prompt
  result += `${nodeName}\n`;
  
  // Recursively format child nodes
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  
  node.children.forEach((child, i) => {
    result += formatTreeNode(
      child,
      childPrefix,
      i === node.children.length - 1
    );
  });
  
  return result;
}

/**
 * Generate a <file_map> ASCII tree structure for selected files
 * @param selectedFiles Files that are selected
 * @param allFiles All files in the repository (if not provided, uses selectedFiles)
 * @param rootFolderName Optional root folder name
 */
export function generateFileMap(
  selectedFiles: FileInfo[], 
  rootFolderName?: string,
  allFiles?: FileInfo[]
): string {
  // Convert flat file list to tree structure
  const fileTree = buildFileTree(allFiles || selectedFiles, selectedFiles);
  
  // Set the root node name if provided
  if (rootFolderName) {
    fileTree.name = rootFolderName;
  }
  
  // Format the tree
  const treeString = formatTreeNode(fileTree);
  
  // Return the formatted tree
  return treeString;
}

/**
 * Generate the full payload for clipboard copying
 */
export function generateClipboardPayload(
  selectedFiles: FileInfo[],
  rootFolderName?: string,
  allFiles?: FileInfo[]
): string {
  const fileMap = generateFileMap(selectedFiles, rootFolderName, allFiles);
  
  return `<file_map>\n${fileMap}</file_map>`;
} 