/**
 * Utilities for generating the full prompt with file contents
 */
import { FileInfo } from '../types/common';
import { generateFileMap, TreeFormatOptions } from './formatUtils';

/**
 * Default options for the file map formatter
 * These are the options used when generating the actual prompt payload
 */
export const DEFAULT_PROMPT_OPTIONS: TreeFormatOptions = {
  showSizes: false,        // Don't include file sizes
  showTokens: false,       // Don't include token estimates
  showBinary: true,        // Mark binary files
  highlightSelected: false, // Don't highlight selected files
  sortDirectoriesFirst: true, // Sort directories before files
  sortBy: 'name',           // Sort by name
  sortDirection: 'asc',    // Sort in ascending order
  showOnlySelected: false, // Show all files for context
  maxDepth: undefined      // No maximum depth
};

// Maximum token limit (2M)
export const MAX_TOKEN_LIMIT = 2000000;

/**
 * Generate the full prompt with file contents
 */
export async function generateFullPrompt(
  selectedFiles: FileInfo[],
  rootFolderName?: string,
  allFiles?: FileInfo[],
  options: TreeFormatOptions = {},
  onProgress?: (progress: {
    current: number, 
    total: number, 
    fileName: string,
    percentage: number
  }) => void
): Promise<{
  prompt: string;
  success: boolean;
  error?: string;
  tokensApprox: number;
  tokenCapExceeded?: boolean;
  processedFiles: number;
  totalFiles: number;
}> {
  // Merge default options with provided options
  const mergedOptions = { ...DEFAULT_PROMPT_OPTIONS, ...options };
  
  // Generate the file map with all files, but marking selected ones
  const fileMap = generateFileMap(selectedFiles, rootFolderName, allFiles, mergedOptions);
  
  // Start building the prompt
  let prompt = `<file_map>\n${fileMap}</file_map>\n\n`;
  
  // Track total token count
  let totalTokens = 0;
  const errors: string[] = [];
  
  // Filter out directories and skipped files
  const filesToProcess = selectedFiles.filter(file => !file.isDirectory && !file.isSkipped);
  const totalFilesCount = filesToProcess.length;
  let processedFiles = 0;
  
  // First calculate total expected tokens to determine if we'll exceed the limit
  const estimatedTotalTokens = filesToProcess.reduce((sum, file) => sum + file.tokenEstimate, 0);
  let tokenCapExceeded = false;
  
  // Add file contents only for selected files
  for (const file of filesToProcess) {
    processedFiles++;
    
    // Report progress
    if (onProgress) {
      onProgress({
        current: processedFiles,
        total: totalFilesCount,
        fileName: file.relativePath,
        percentage: Math.round((processedFiles / totalFilesCount) * 100)
      });
    }
    
    try {
      // Check if adding this file would exceed the token limit
      if (totalTokens + file.tokenEstimate > MAX_TOKEN_LIMIT) {
        tokenCapExceeded = true;
        errors.push(`Token limit of ${MAX_TOKEN_LIMIT.toLocaleString()} exceeded. Some files were omitted.`);
        break;
      }
      
      // Read file content from main process
      const result: any = await window.api.readFileContent(file.path);
      
      if (result.isSkipped) {
        errors.push(`Skipped ${file.relativePath}: ${result.error || 'File is binary or too large'}`);
        continue;
      }
      
      const content = result.content;
      if (!content) continue;
      
      // Add to the prompt
      prompt += `<file_contents path="${file.relativePath}">\n${content}\n</file_contents>\n\n`;
      
      // Update token count
      totalTokens += file.tokenEstimate;
    } catch (error) {
      errors.push(`Error reading ${file.relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return {
    prompt,
    success: errors.length === 0,
    error: errors.length > 0 ? errors.join('\n') : undefined,
    tokensApprox: totalTokens,
    tokenCapExceeded,
    processedFiles,
    totalFiles: totalFilesCount
  };
}

/**
 * Copy the full prompt to clipboard
 */
export async function copyPromptToClipboard(
  selectedFiles: FileInfo[],
  rootFolderName?: string,
  allFiles?: FileInfo[],
  options: TreeFormatOptions = {},
  onProgress?: (progress: {
    current: number, 
    total: number, 
    fileName: string,
    percentage: number
  }) => void
): Promise<{
  success: boolean;
  error?: string;
  tokensApprox: number;
  tokenCapExceeded?: boolean;
  processedFiles: number;
  totalFiles: number;
}> {
  try {
    // Generate the full prompt
    const result = await generateFullPrompt(
      selectedFiles,
      rootFolderName,
      allFiles,
      options,
      onProgress
    );
    
    if (!result.success && !result.tokenCapExceeded) {
      return { 
        success: false, 
        error: result.error, 
        tokensApprox: result.tokensApprox,
        processedFiles: result.processedFiles,
        totalFiles: result.totalFiles
      };
    }
    
    // Copy to clipboard
    const clipboardResult: any = await window.api.writeToClipboard(result.prompt);
    
    if (!clipboardResult.success) {
      return {
        success: false,
        error: clipboardResult.error || 'Failed to copy to clipboard',
        tokensApprox: result.tokensApprox,
        tokenCapExceeded: result.tokenCapExceeded,
        processedFiles: result.processedFiles,
        totalFiles: result.totalFiles
      };
    }
    
    return { 
      success: true, 
      tokensApprox: result.tokensApprox,
      tokenCapExceeded: result.tokenCapExceeded,
      processedFiles: result.processedFiles,
      totalFiles: result.totalFiles
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      tokensApprox: 0,
      processedFiles: 0,
      totalFiles: selectedFiles.filter(f => !f.isDirectory && !f.isSkipped).length
    };
  }
} 