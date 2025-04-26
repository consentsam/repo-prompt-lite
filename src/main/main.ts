import { app, BrowserWindow, dialog, ipcMain, clipboard } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { createReadStream } from 'fs';
import { IgnoreManager } from './ignoreUtils';

// Utility to check if a file is likely binary
function isLikelyBinary(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  const binaryExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico',
    '.pdf', '.zip', '.gz', '.tar', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.avi', '.mov', '.flv', '.wmv',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.bin', '.dat', '.db', '.sqlite', '.class', '.obj'
  ];
  
  return binaryExtensions.includes(extension);
}

// Rough token estimator (for text files)
function estimateTokens(content: string): number {
  // Very rough estimate: 4 chars per token (GPT tokenization is more complex)
  // This is a simplified approach
  return Math.ceil(content.length / 4);
}

function createWindow() {
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
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// Handle folder selection dialog
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select a folder to import',
  });
  
  if (canceled) {
    return null;
  }
  
  return filePaths[0];
});

// Verify dropped folder exists
ipcMain.handle('verify:droppedFolder', async (_, folderPath) => {
  try {
    const stats = await fs.promises.stat(folderPath);
    if (stats.isDirectory()) {
      return folderPath;
    }
    return null;
  } catch (error) {
    console.error('Error verifying dropped folder:', error);
    return null;
  }
});

// Directory walker
ipcMain.handle('directory:walk', async (event, folderPath) => {
  const results: Array<{
    path: string;
    relativePath: string;
    size: number;
    isDirectory: boolean;
    isSkipped: boolean;
    tokenEstimate: number;
  }> = [];
  
  let fileCount = 0;
  let totalSize = 0;
  let totalTokens = 0;
  
  const ONE_MB = 1024 * 1024;
  
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
            processing: relativePath
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
            
            // Skip binary files and files ≥ 1MB
            const shouldSkip = isLikelyBinary(fullPath) || fileSize >= ONE_MB;
            
            let tokenEstimate = 0;
            if (!shouldSkip) {
              try {
                const content = await fs.promises.readFile(fullPath, 'utf8');
                tokenEstimate = estimateTokens(content);
                totalTokens += tokenEstimate;
              } catch (readError) {
                // If we can't read as UTF-8, it's likely binary
                console.error(`Error reading file ${fullPath}:`, readError);
              }
            }
            
            results.push({
              path: fullPath,
              relativePath,
              size: fileSize,
              isDirectory: false,
              isSkipped: shouldSkip,
              tokenEstimate: shouldSkip ? 0 : tokenEstimate
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
      done: true
    });
    
    return {
      rootPath: folderPath,
      files: results,
      stats: {
        fileCount,
        totalSize,
        totalTokens
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
ipcMain.handle('file:readContent', async (_, filePath) => {
  try {
    // Check if file is in an ignored directory
    const dirPath = path.dirname(filePath);
    const ignoreManager = new IgnoreManager(dirPath);
    await ignoreManager.loadIgnoreFile();
    
    if (ignoreManager.shouldIgnore(filePath)) {
      return {
        content: '',
        error: 'File is in an ignored directory',
        isSkipped: true
      };
    }
    
    const stats = await fs.promises.stat(filePath);
    
    // Skip binary files and large files
    const ONE_MB = 1024 * 1024;
    if (isLikelyBinary(filePath) || stats.size >= ONE_MB) {
      return {
        content: '',
        error: 'File is binary or too large',
        isSkipped: true
      };
    }
    
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
      isSkipped: true
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

app.whenReady().then(createWindow);

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