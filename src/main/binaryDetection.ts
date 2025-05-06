import fs from 'fs';
import path from 'path';

/**
 * Common binary file extensions
 */
export const BINARY_EXTENSIONS = [
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico', '.webp', '.svg',
  // Archives
  '.zip', '.gz', '.tar', '.rar', '.7z', '.jar', '.war', '.ear',
  // Executables
  '.exe', '.dll', '.so', '.dylib', '.bin', '.apk', '.app',
  // Media
  '.mp3', '.mp4', '.avi', '.mov', '.flv', '.wmv', '.wav', '.ogg', '.webm',
  // Office documents
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf',
  // Database/binary data
  '.db', '.sqlite', '.dat', '.bin', '.class', '.obj', '.o', '.pyc',
  // Font files
  '.ttf', '.woff', '.woff2', '.eot', '.otf'
];

/**
 * Configuration for binary detection
 */
export interface BinaryDetectionOptions {
  maxSizeBytes?: number;       // Maximum file size (default: 1MB)
  checkContent?: boolean;      // Whether to check file content (default: true)
  checkExtension?: boolean;    // Whether to check file extension (default: true)
  sampleSize?: number;         // Bytes to sample for content check (default: 512)
  binaryThreshold?: number;    // Binary threshold percentage (default: 10%)
}

/**
 * Default options for binary detection
 */
export const DEFAULT_BINARY_OPTIONS: BinaryDetectionOptions = {
  maxSizeBytes: 1024 * 1024,   // 1MB
  checkContent: true,
  checkExtension: true,
  sampleSize: 512,             // Sample 512 bytes
  binaryThreshold: 10          // 10% non-UTF8 characters
};

/**
 * Result of a binary file check
 */
export interface BinaryCheckResult {
  isBinary: boolean;
  reason?: 'extension' | 'size' | 'content';
  details?: string;
}

/**
 * Check if a file is likely binary based on extension
 */
export function isLikelyBinaryByExtension(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(extension);
}

/**
 * Sample file content to detect binary data
 * This checks for the presence of null bytes and other non-printable characters
 * that are unlikely to appear in text files
 */
export async function sampleFileContent(
  filePath: string, 
  sampleSize = 512
): Promise<{ isBinary: boolean, nonTextPercentage: number }> {
  return new Promise((resolve, reject) => {
    try {
      const fileStream = fs.createReadStream(filePath, {
        encoding: 'binary',
        start: 0,
        end: sampleSize - 1
      });
      
      let buffer = '';
      let nonTextChars = 0;
      
      fileStream.on('data', (chunk) => {
        buffer += chunk;
      });
      
      fileStream.on('end', () => {
        // Count null bytes and control characters (except common ones like newlines, tabs)
        for (let i = 0; i < buffer.length; i++) {
          const charCode = buffer.charCodeAt(i);
          // Check for null bytes or non-printable controls (except tabs, newlines, etc.)
          if (charCode === 0 || (charCode < 9 || (charCode > 13 && charCode < 32))) {
            nonTextChars++;
          }
        }
        
        const nonTextPercentage = (nonTextChars / buffer.length) * 100;
        const isBinary = nonTextPercentage > 10; // Consider binary if > 10% non-text chars
        
        resolve({ isBinary, nonTextPercentage });
      });
      
      fileStream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check if a file is binary based on multiple heuristics
 */
export async function isFileBinary(
  filePath: string,
  options: BinaryDetectionOptions = DEFAULT_BINARY_OPTIONS
): Promise<BinaryCheckResult> {
  const mergedOptions = { ...DEFAULT_BINARY_OPTIONS, ...options };
  
  try {
    // 1. Check file size
    const stats = await fs.promises.stat(filePath);
    if (stats.size > (mergedOptions.maxSizeBytes || 1024 * 1024)) {
      return {
        isBinary: true,
        reason: 'size',
        details: `File exceeds maximum size (${formatFileSize(stats.size)})`
      };
    }
    
    // 2. Check extension
    if (mergedOptions.checkExtension && isLikelyBinaryByExtension(filePath)) {
      return {
        isBinary: true,
        reason: 'extension',
        details: `File has binary extension (${path.extname(filePath)})`
      };
    }
    
    // 3. Sample file content
    if (mergedOptions.checkContent) {
      const { isBinary, nonTextPercentage } = await sampleFileContent(
        filePath, 
        mergedOptions.sampleSize
      );
      
      if (isBinary) {
        return {
          isBinary: true,
          reason: 'content',
          details: `Content appears to be binary (${nonTextPercentage.toFixed(1)}% non-text characters)`
        };
      }
    }
    
    // If we get here, it's not binary
    return { isBinary: false };
  } catch (error) {
    console.error(`Error checking if file is binary: ${filePath}`, error);
    // Assume binary in case of error to be safe
    return {
      isBinary: true,
      reason: 'content',
      details: `Error checking file: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Formats a file size in bytes to a human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
} 