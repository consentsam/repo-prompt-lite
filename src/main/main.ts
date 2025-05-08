import { app, BrowserWindow, dialog, ipcMain, clipboard } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { createReadStream } from 'fs';
import { IgnoreManager } from './ignoreUtils';
import { 
  isFileBinary, 
  isLikelyBinaryByExtension, 
  BinaryDetectionOptions, 
  DEFAULT_BINARY_OPTIONS 
} from './binaryDetection';

// Define the FileInfo interface
interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  isDirectory: boolean;
  isSkipped: boolean;
  skipReason?: string;
  tokenEstimate: number;
  hasChildren?: boolean;
  childrenLoaded?: boolean;
  hasLazyChildren?: boolean;
}

// Binary detection options - used throughout the app
const binaryDetectionOptions: BinaryDetectionOptions = {
  ...DEFAULT_BINARY_OPTIONS,
  // Override defaults if needed
};

// Simple token estimator for text files
function estimateTokens(content: string): number {
  // Very rough estimate: 4 chars per token (GPT tokenization is more complex)
  // This is a simplified approach
  return Math.ceil(content.length / 4);
}

// Function to create the main application window
function createWindow() {
  console.log("Creating the main window...");
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    console.log("Loading URL:", process.env.ELECTRON_RENDERER_URL);
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    console.log("Loading local file...");
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// Handle folder selection dialog
ipcMain.handle('dialog:openDirectory', async () => {
  console.log("Opening directory dialog...");
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select a folder to import',
  });
  
  if (canceled) {
    console.log("Directory selection canceled.");
    return null;
  }
  
  console.log("Selected folder:", filePaths[0]);
  return filePaths[0];
});

// Verify dropped folder exists
ipcMain.handle('verify:droppedFolder', async (_, folderPath) => {
  console.log("Verifying dropped folder:", folderPath);
  try {
    const stats = await fs.promises.stat(folderPath);
    if (stats.isDirectory()) {
      console.log("Valid directory:", folderPath);
      return folderPath;
    }
    console.log("Not a directory:", folderPath);
    return null;
  } catch (error) {
    console.error('Error verifying dropped folder:', error);
    return null;
  }
});

// Directory walker
ipcMain.handle('directory:walk', async (event, folderPath, options = {}) => {
  const results: Array<{
    path: string;
    relativePath: string;
    size: number;
    isDirectory: boolean;
    isSkipped: boolean;
    skipReason?: string;
    tokenEstimate: number;
  }> = [];
  
  let fileCount = 0;
  let totalSize = 0;
  let totalTokens = 0;
  let skippedCount = 0;
  let binaryCount = 0;
  let sizeSkippedCount = 0;
  
  // Customize binary detection options
  const detectionOptions: BinaryDetectionOptions = {
    ...binaryDetectionOptions,
    ...options.binaryDetection,
  };
  
  try {
    // Initialize and load the ignore manager
    const ignoreManager = new IgnoreManager(folderPath);
    await ignoreManager.loadIgnoreFile();
    
    // Function to recursively walk directories
    async function walk(dir: string, baseDir: string): Promise<void> {
      // Check if directory is ignored
      if (ignoreManager.shouldIgnore(dir)) {
        return;
      }
      
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        
        // Check if this file/directory should be ignored
        if (ignoreManager.shouldIgnore(fullPath)) {
          continue;
        }
        
        // Send progress update
        fileCount++;
        if (fileCount % 10 === 0) { // Send update every 10 files
          event.sender.send('directory:walkProgress', {
            fileCount,
            totalSize,
            totalTokens,
            processing: relativePath,
            skippedCount,
            binaryCount,
            sizeSkippedCount
          });
        }
        
        if (entry.isDirectory()) {
          results.push({
            path: fullPath,
            relativePath,
            size: 0,
            isDirectory: true,
            isSkipped: false,
            tokenEstimate: 0
          });
          
          await walk(fullPath, baseDir);
        } else {
          try {
            const stats = await fs.promises.stat(fullPath);
            const fileSize = stats.size;
            totalSize += fileSize;
            
            // Determine if file should be skipped (binary or too large)
            let isSkipped = false;
            let skipReason = '';
            
            // Check for binary content
            const binaryCheck = await isFileBinary(fullPath, detectionOptions);
            
            if (binaryCheck.isBinary) {
              isSkipped = true;
              skipReason = binaryCheck.details || 'Binary file';
              
              if (binaryCheck.reason === 'size') {
                sizeSkippedCount++;
              } else {
                binaryCount++;
              }
              
              skippedCount++;
            }
            
            let tokenEstimate = 0;
            if (!isSkipped) {
              try {
                const content = await fs.promises.readFile(fullPath, 'utf8');
                tokenEstimate = estimateTokens(content);
                totalTokens += tokenEstimate;
              } catch (readError) {
                // If we can't read as UTF-8, it's likely binary
                console.error(`Error reading file ${fullPath}:`, readError);
                isSkipped = true;
                skipReason = 'Failed to read as text';
                binaryCount++;
                skippedCount++;
              }
            }
            
            results.push({
              path: fullPath,
              relativePath,
              size: fileSize,
              isDirectory: false,
              isSkipped,
              skipReason,
              tokenEstimate: isSkipped ? 0 : tokenEstimate
            });
          } catch (statError) {
            console.error(`Error getting stats for ${fullPath}:`, statError);
          }
        }
      }
    }
    
    await walk(folderPath, folderPath);
    
    // Final progress update
    event.sender.send('directory:walkProgress', {
      fileCount,
      totalSize,
      totalTokens,
      processing: 'Complete',
      skippedCount,
      binaryCount,
      sizeSkippedCount,
      done: true
    });
    
    return {
      rootPath: folderPath,
      files: results,
      stats: {
        fileCount,
        totalSize,
        totalTokens,
        skippedCount,
        binaryCount,
        sizeSkippedCount
      }
    };
  } catch (error) {
    console.error('Error walking directory:', error);
    event.sender.send('directory:walkProgress', {
      error: true,
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
});

// Read file contents
ipcMain.handle('file:readContent', async (_, filePath, options = {}) => {
  console.log(`Reading file content: ${filePath}`);
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        content: '',
        error: 'File does not exist',
        isSkipped: true,
        skipReason: 'not_found'
      };
    }
    
    // Get file stats
    const stats = await fs.promises.stat(filePath);
    
    // Check if file is binary using the binaryDetection utility
    const binaryOptions = options.binaryDetection || DEFAULT_BINARY_OPTIONS;
    const binaryCheck = await isFileBinary(filePath, binaryOptions);
    
    if (binaryCheck.isBinary) {
      return {
        content: '',
        error: binaryCheck.details || 'File is binary or too large',
        isSkipped: true,
        skipReason: binaryCheck.reason,
        details: binaryCheck.details
      };
    }
    
    // Read the file content
    const content = await fs.promises.readFile(filePath, 'utf8');
    return {
      content,
      isSkipped: false
    };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return {
      content: '',
      error: error instanceof Error ? error.message : String(error),
      isSkipped: true,
      skipReason: 'error'
    };
  }
});

// Fetch directory children on demand
ipcMain.handle('directory:fetchChildren', async (event, dirPath, detectionOptions = {}) => {
  try {
    const results: FileInfo[] = [];
    let fileCount = 0;
    let totalSize = 0;
    let totalTokens = 0;
    let skippedCount = 0;
    let binaryCount = 0;
    let sizeSkippedCount = 0;
    
    // Initialize ignore manager
    const ignoreManager = new IgnoreManager(dirPath);
    await ignoreManager.loadIgnoreFile();
    
    // Check if directory is ignored
    if (ignoreManager.shouldIgnore(dirPath)) {
      return {
        children: [],
        error: 'Directory is ignored'
      };
    }
    
    // Read directory entries
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    // Process each entry
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(path.dirname(dirPath), fullPath);
      
      // Check if this file/directory should be ignored
      if (ignoreManager.shouldIgnore(fullPath)) {
        continue;
      }
      
      fileCount++;
      
      if (entry.isDirectory()) {
        results.push({
          path: fullPath,
          relativePath,
          size: 0,
          isDirectory: true,
          isSkipped: false,
          tokenEstimate: 0,
          hasChildren: true, // Mark as having children for lazy loading
          childrenLoaded: false, // Mark that children aren't loaded yet
          hasLazyChildren: true // Mark that this directory has unloaded children
        });
      } else {
        try {
          const stats = await fs.promises.stat(fullPath);
          const fileSize = stats.size;
          totalSize += fileSize;
          
          // Determine if file should be skipped (binary or too large)
          let isSkipped = false;
          let skipReason = '';
          
          // Check for binary content
          const binaryCheck = await isFileBinary(fullPath, detectionOptions);
          
          if (binaryCheck.isBinary) {
            isSkipped = true;
            skipReason = binaryCheck.details || 'Binary file';
            
            if (binaryCheck.reason === 'size') {
              sizeSkippedCount++;
            } else {
              binaryCount++;
            }
            
            skippedCount++;
          }
          
          let tokenEstimate = 0;
          if (!isSkipped) {
            try {
              const content = await fs.promises.readFile(fullPath, 'utf8');
              tokenEstimate = estimateTokens(content);
              totalTokens += tokenEstimate;
            } catch (readError) {
              // If we can't read as UTF-8, it's likely binary
              isSkipped = true;
              skipReason = 'Failed to read as text';
              binaryCount++;
              skippedCount++;
            }
          }
          
          results.push({
            path: fullPath,
            relativePath,
            size: fileSize,
            isDirectory: false,
            isSkipped,
            skipReason,
            tokenEstimate: isSkipped ? 0 : tokenEstimate
          });
        } catch (statError) {
          console.error(`Error getting stats for ${fullPath}:`, statError);
        }
      }
    }
    
    return {
      children: results,
      stats: {
        fileCount,
        totalSize,
        totalTokens,
        skippedCount,
        binaryCount,
        sizeSkippedCount
      }
    };
  } catch (error) {
    console.error('Error fetching directory children:', error);
    return {
      children: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Build and write prompt to clipboard
ipcMain.handle('clipboard:writePrompt', async (_, payload) => {
  try {
    clipboard.writeText(payload);
    return { success: true };
  } catch (error) {
    console.error('Error writing to clipboard:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Define the return type for lazy directory loading
interface LazyChildResult {
  children: FileInfo[];
  stats: {
    fileCount: number;
    totalSize: number;
    totalTokens: number;
    skippedCount: number;
    binaryCount: number;
    sizeSkippedCount: number;
  };
}

// Register all IPC handlers to ensure correct communication between main and renderer processes
function registerIpcHandlers() {
  // Directory walker handler was already defined above

  // Handler for lazy loading child directories
  ipcMain.handle('directory:lazyLoadChildren', async (event, dirPath, options = {}) => {
    console.log(`Lazy loading children for directory: ${dirPath}`);
    try {
      if (!fs.existsSync(dirPath)) {
        return { error: 'Directory does not exist' };
      }

      const rootPath = dirPath;
      const binaryOptions = options.binaryDetection || DEFAULT_BINARY_OPTIONS;
      const ignoreManager = new IgnoreManager(rootPath);
      await ignoreManager.loadIgnoreFile();
      
      let fileCount = 0;
      let totalSize = 0;
      let totalTokens = 0;
      let skippedCount = 0;
      let binaryCount = 0;
      let sizeSkippedCount = 0;
      
      const children: FileInfo[] = [];
      
      // Read immediate children of the directory
      const items = await fs.promises.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const relativePath = path.relative(rootPath, itemPath);
        
        // Skip files and directories specified in ignore files
        if (ignoreManager.shouldIgnore(itemPath)) {
          continue;
        }
        
        try {
          const stats = await fs.promises.stat(itemPath);
          
          if (stats.isDirectory()) {
            // For directories, just add them without recursion
            children.push({
              path: itemPath,
              relativePath,
              size: 0, // Will be updated when directory is loaded
              isDirectory: true,
              isSkipped: false,
              tokenEstimate: 0,
              hasLazyChildren: true // Mark that this directory has unloaded children
            });
          } else {
            // For files, check if they're binary or too large
            fileCount++;
            
            // Skip binary files and files larger than the limit
            const fileSizeBytes = stats.size;
            let isSkipped = false;
            let skipReason = '';
            
            // Check file size first (faster than binary check)
            const binaryCheck = await isFileBinary(itemPath, binaryOptions);
            if (binaryCheck.isBinary) {
              isSkipped = true;
              skipReason = binaryCheck.details || 'Binary file';
              
              if (binaryCheck.reason === 'size') {
                sizeSkippedCount++;
              } else {
                binaryCount++;
              }
              
              skippedCount++;
            }
            
            // Estimate tokens based on file size if not binary
            let tokenEstimate = 0;
            if (!isSkipped) {
              try {
                const content = await fs.promises.readFile(itemPath, 'utf8');
                tokenEstimate = estimateTokens(content);
                totalTokens += tokenEstimate;
              } catch (readError) {
                // If we can't read as UTF-8, it's likely binary
                console.error(`Error reading file ${itemPath}:`, readError);
                isSkipped = true;
                skipReason = 'Failed to read as text';
                binaryCount++;
                skippedCount++;
              }
            }
            
            // Update totals
            totalSize += fileSizeBytes;
            
            // Add file info
            children.push({
              path: itemPath,
              relativePath,
              size: fileSizeBytes,
              isDirectory: false,
              isSkipped,
              skipReason,
              tokenEstimate
            });
          }
        } catch (err) {
          console.error(`Error processing ${itemPath}:`, err);
        }
      }
      
      return {
        children,
        stats: {
          fileCount,
          totalSize,
          totalTokens,
          skippedCount,
          binaryCount,
          sizeSkippedCount
        }
      } as LazyChildResult;
    } catch (error) {
      console.error('Error in lazyLoadChildren:', error);
      return { error: 'Failed to load directory children' };
    }
  });

  // IPC Handler for generating payload and writing to clipboard
  ipcMain.handle('generate-payload-and-copy', async (_, selectedFiles: Array<{ path: string; relativePath: string; tokenEstimate: number; isDirectory: boolean; isSkipped: boolean }>) => {
    const MAX_TOKENS = 2000000;
    const WARN_TOKENS_THRESHOLD = 1800000; // 90% of MAX_TOKENS
    let currentTotalTokens = 0;
    let payload = '';
    let filesProcessedCount = 0;
    let allFilesProcessed = true;

    console.log('[Main] Received request to generate payload for an_array_of_selected_files_with_length:', selectedFiles.length);

    for (const file of selectedFiles) {
      if (file.isDirectory || file.isSkipped) {
        continue;
      }

      if (currentTotalTokens + file.tokenEstimate > MAX_TOKENS) {
        console.warn(`[Main] Token limit (${MAX_TOKENS}) reached. Stopping payload generation. Processed ${filesProcessedCount} files.`);
        allFilesProcessed = false;
        break; // Stop adding more files
      }

      try {
        const content = await fs.promises.readFile(file.path, 'utf-8');
        payload += `<file_path>${file.relativePath}</file_path>\n<file_contents>\n${content}\n</file_contents>\n\n`;
        currentTotalTokens += file.tokenEstimate;
        filesProcessedCount++;

        if (currentTotalTokens > WARN_TOKENS_THRESHOLD && allFilesProcessed) {
          // Log warning only once if we are still processing all files and cross the threshold
          console.warn(`[Main] Payload approaching token limit. Current tokens: ${currentTotalTokens}`);
        }

      } catch (error) {
        console.error(`[Main] Error reading file ${file.path}:`, error);
        // Optionally, decide if this error should stop the whole process or just skip the file
        // For now, we skip the file and log the error.
      }
    }

    if (payload.length === 0 && selectedFiles.filter(f => !f.isDirectory && !f.isSkipped).length > 0) {
      console.warn("[Main] No payload generated, possibly due to all selected files exceeding token limit individually or read errors.");
      return { success: false, message: 'No content generated. Files might be too large or unreadable.' };
    }

    if (payload.length > 0) {
      clipboard.writeText(payload.trim()); // Trim trailing newlines
      const message = allFilesProcessed
        ? `Successfully copied ${filesProcessedCount} files to clipboard.`
        : `Copied ${filesProcessedCount} files to clipboard. Token limit reached, some files may have been excluded.`;
      console.log(`[Main] ${message} Total tokens: ${currentTotalTokens}`);
      return { success: true, message, CANCELED_BECAUSE_TOO_LARGE_BOOLEAN: !allFilesProcessed, tokens: currentTotalTokens };
    }

    return { success: false, message: 'No files selected or processed.' };
  });
}

// Call registerIpcHandlers when the app is ready
app.whenReady().then(() => {
  // Register all IPC handlers first
  registerIpcHandlers();
  // Then create the main window
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 