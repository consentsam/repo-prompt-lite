/**
 * Utilities for generating the full prompt with file contents
 */
import { FileInfo } from '../types/common';
import { generateFileMap } from './formatUtils';

/**
 * Generate the full prompt with file contents
 */
export async function generateFullPrompt(
  selectedFiles: FileInfo[],
  rootFolderName?: string
): Promise<{
  prompt: string;
  success: boolean;
  error?: string;
  tokensApprox: number;
}> {
  // Generate the file map
  const fileMap = generateFileMap(selectedFiles, rootFolderName);
  
  // Start building the prompt
  let prompt = `<file_map>\n${fileMap}</file_map>\n\n`;
  
  // Track total token count
  let totalTokens = 0;
  const errors: string[] = [];
  
  // Add file contents
  for (const file of selectedFiles) {
    if (file.isDirectory || file.isSkipped) continue;
    
    try {
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
    tokensApprox: totalTokens
  };
}

/**
 * Copy the full prompt to clipboard
 */
export async function copyPromptToClipboard(
  selectedFiles: FileInfo[],
  rootFolderName?: string
): Promise<{
  success: boolean;
  error?: string;
  tokensApprox: number;
}> {
  try {
    // Generate the full prompt
    const { prompt, success, error, tokensApprox } = await generateFullPrompt(
      selectedFiles,
      rootFolderName
    );
    
    if (!success) {
      return { success: false, error, tokensApprox };
    }
    
    // Copy to clipboard
    const clipboardResult: any = await window.api.writeToClipboard(prompt);
    
    if (!clipboardResult.success) {
      return {
        success: false,
        error: clipboardResult.error || 'Failed to copy to clipboard',
        tokensApprox
      };
    }
    
    return { success: true, tokensApprox };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      tokensApprox: 0
    };
  }
} 