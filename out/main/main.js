"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
function isMatch(filePath, pattern) {
  let regexPattern = pattern.replace(/\./g, "\\.").replace(/\*\*/g, "{{GLOBSTAR}}").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/{{GLOBSTAR}}/g, ".*");
  if (!regexPattern.startsWith("^")) {
    regexPattern = "^" + regexPattern;
  }
  if (!regexPattern.endsWith("$")) {
    regexPattern += "$";
  }
  const regex = new RegExp(regexPattern);
  return regex.test(filePath);
}
class IgnoreManager {
  ignorePatterns = [];
  rootPath = "";
  loaded = false;
  constructor(rootPath) {
    this.rootPath = rootPath;
  }
  async loadIgnoreFile() {
    try {
      const ignoreFilePath = path.join(this.rootPath, ".repopromptignore");
      try {
        await fs.promises.access(ignoreFilePath);
      } catch {
        this.ignorePatterns = ["node_modules/**", ".git/**"];
        this.loaded = true;
        return;
      }
      const content = await fs.promises.readFile(ignoreFilePath, "utf8");
      this.ignorePatterns = content.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map((pattern) => {
        if (!pattern.includes("/") && !pattern.endsWith("/**")) {
          return `${pattern}/**`;
        }
        return pattern;
      });
      if (!this.ignorePatterns.some((p) => p.startsWith("node_modules"))) {
        this.ignorePatterns.push("node_modules/**");
      }
      if (!this.ignorePatterns.some((p) => p.startsWith(".git"))) {
        this.ignorePatterns.push(".git/**");
      }
      this.loaded = true;
    } catch (error) {
      console.error("Error loading ignore file:", error);
      this.ignorePatterns = ["node_modules/**", ".git/**"];
      this.loaded = true;
    }
  }
  shouldIgnore(filePath) {
    if (!this.loaded) {
      throw new Error("Ignore patterns not loaded yet. Call loadIgnoreFile() first.");
    }
    const relativePath = path.relative(this.rootPath, filePath);
    for (const pattern of this.ignorePatterns) {
      if (isMatch(relativePath, pattern)) {
        return true;
      }
    }
    return false;
  }
}
const BINARY_EXTENSIONS = [
  // Images
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".tiff",
  ".ico",
  ".webp",
  ".svg",
  // Archives
  ".zip",
  ".gz",
  ".tar",
  ".rar",
  ".7z",
  ".jar",
  ".war",
  ".ear",
  // Executables
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".apk",
  ".app",
  // Media
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".flv",
  ".wmv",
  ".wav",
  ".ogg",
  ".webm",
  // Office documents
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".pdf",
  // Database/binary data
  ".db",
  ".sqlite",
  ".dat",
  ".bin",
  ".class",
  ".obj",
  ".o",
  ".pyc",
  // Font files
  ".ttf",
  ".woff",
  ".woff2",
  ".eot",
  ".otf"
];
const DEFAULT_BINARY_OPTIONS = {
  maxSizeBytes: 1024 * 1024,
  // 1MB
  checkContent: true,
  checkExtension: true,
  sampleSize: 512,
  // Sample 512 bytes
  binaryThreshold: 10
  // 10% non-UTF8 characters
};
function isLikelyBinaryByExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(extension);
}
async function sampleFileContent(filePath, sampleSize = 512) {
  return new Promise((resolve, reject) => {
    try {
      const fileStream = fs.createReadStream(filePath, {
        encoding: "binary",
        start: 0,
        end: sampleSize - 1
      });
      let buffer = "";
      let nonTextChars = 0;
      fileStream.on("data", (chunk) => {
        buffer += chunk;
      });
      fileStream.on("end", () => {
        for (let i = 0; i < buffer.length; i++) {
          const charCode = buffer.charCodeAt(i);
          if (charCode === 0 || (charCode < 9 || charCode > 13 && charCode < 32)) {
            nonTextChars++;
          }
        }
        const nonTextPercentage = nonTextChars / buffer.length * 100;
        const isBinary = nonTextPercentage > 10;
        resolve({ isBinary, nonTextPercentage });
      });
      fileStream.on("error", (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}
async function isFileBinary(filePath, options = DEFAULT_BINARY_OPTIONS) {
  const mergedOptions = { ...DEFAULT_BINARY_OPTIONS, ...options };
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.size > (mergedOptions.maxSizeBytes || 1024 * 1024)) {
      return {
        isBinary: true,
        reason: "size",
        details: `File exceeds maximum size (${formatFileSize(stats.size)})`
      };
    }
    if (mergedOptions.checkExtension && isLikelyBinaryByExtension(filePath)) {
      return {
        isBinary: true,
        reason: "extension",
        details: `File has binary extension (${path.extname(filePath)})`
      };
    }
    if (mergedOptions.checkContent) {
      const { isBinary, nonTextPercentage } = await sampleFileContent(
        filePath,
        mergedOptions.sampleSize
      );
      if (isBinary) {
        return {
          isBinary: true,
          reason: "content",
          details: `Content appears to be binary (${nonTextPercentage.toFixed(1)}% non-text characters)`
        };
      }
    }
    return { isBinary: false };
  } catch (error) {
    console.error(`Error checking if file is binary: ${filePath}`, error);
    return {
      isBinary: true,
      reason: "content",
      details: `Error checking file: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
const binaryDetectionOptions = {
  ...DEFAULT_BINARY_OPTIONS
  // Override defaults if needed
};
function estimateTokens(content) {
  return Math.ceil(content.length / 4);
}
function createWindow() {
  console.log("Creating the main window...");
  const win = new electron.BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    console.log("Loading URL:", process.env.ELECTRON_RENDERER_URL);
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    console.log("Loading local file...");
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.ipcMain.handle("dialog:openDirectory", async () => {
  console.log("Opening directory dialog...");
  const { canceled, filePaths } = await electron.dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select a folder to import"
  });
  if (canceled) {
    console.log("Directory selection canceled.");
    return null;
  }
  console.log("Selected folder:", filePaths[0]);
  return filePaths[0];
});
electron.ipcMain.handle("verify:droppedFolder", async (_, folderPath) => {
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
    console.error("Error verifying dropped folder:", error);
    return null;
  }
});
electron.ipcMain.handle("directory:walk", async (event, folderPath, options = {}) => {
  const results = [];
  let fileCount = 0;
  let totalSize = 0;
  let totalTokens = 0;
  let skippedCount = 0;
  let binaryCount = 0;
  let sizeSkippedCount = 0;
  const detectionOptions = {
    ...binaryDetectionOptions,
    ...options.binaryDetection
  };
  try {
    const ignoreManager = new IgnoreManager(folderPath);
    await ignoreManager.loadIgnoreFile();
    async function walk(dir, baseDir) {
      if (ignoreManager.shouldIgnore(dir)) {
        return;
      }
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        if (ignoreManager.shouldIgnore(fullPath)) {
          continue;
        }
        fileCount++;
        if (fileCount % 10 === 0) {
          event.sender.send("directory:walkProgress", {
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
            let isSkipped = false;
            let skipReason = "";
            const binaryCheck = await isFileBinary(fullPath, detectionOptions);
            if (binaryCheck.isBinary) {
              isSkipped = true;
              skipReason = binaryCheck.details || "Binary file";
              if (binaryCheck.reason === "size") {
                sizeSkippedCount++;
              } else {
                binaryCount++;
              }
              skippedCount++;
            }
            let tokenEstimate = 0;
            if (!isSkipped) {
              try {
                const content = await fs.promises.readFile(fullPath, "utf8");
                tokenEstimate = estimateTokens(content);
                totalTokens += tokenEstimate;
              } catch (readError) {
                console.error(`Error reading file ${fullPath}:`, readError);
                isSkipped = true;
                skipReason = "Failed to read as text";
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
    event.sender.send("directory:walkProgress", {
      fileCount,
      totalSize,
      totalTokens,
      processing: "Complete",
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
    console.error("Error walking directory:", error);
    event.sender.send("directory:walkProgress", {
      error: true,
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
});
electron.ipcMain.handle("file:readContent", async (_, filePath, options = {}) => {
  console.log(`Reading file content: ${filePath}`);
  try {
    if (!fs.existsSync(filePath)) {
      return {
        content: "",
        error: "File does not exist",
        isSkipped: true,
        skipReason: "not_found"
      };
    }
    const stats = await fs.promises.stat(filePath);
    const binaryOptions = options.binaryDetection || DEFAULT_BINARY_OPTIONS;
    const binaryCheck = await isFileBinary(filePath, binaryOptions);
    if (binaryCheck.isBinary) {
      return {
        content: "",
        error: binaryCheck.details || "File is binary or too large",
        isSkipped: true,
        skipReason: binaryCheck.reason,
        details: binaryCheck.details
      };
    }
    const content = await fs.promises.readFile(filePath, "utf8");
    return {
      content,
      isSkipped: false
    };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return {
      content: "",
      error: error instanceof Error ? error.message : String(error),
      isSkipped: true,
      skipReason: "error"
    };
  }
});
electron.ipcMain.handle("directory:fetchChildren", async (event, dirPath, detectionOptions = {}) => {
  try {
    const results = [];
    let fileCount = 0;
    let totalSize = 0;
    let totalTokens = 0;
    let skippedCount = 0;
    let binaryCount = 0;
    let sizeSkippedCount = 0;
    const ignoreManager = new IgnoreManager(dirPath);
    await ignoreManager.loadIgnoreFile();
    if (ignoreManager.shouldIgnore(dirPath)) {
      return {
        children: [],
        error: "Directory is ignored"
      };
    }
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(path.dirname(dirPath), fullPath);
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
          hasChildren: true,
          // Mark as having children for lazy loading
          childrenLoaded: false,
          // Mark that children aren't loaded yet
          hasLazyChildren: true
          // Mark that this directory has unloaded children
        });
      } else {
        try {
          const stats = await fs.promises.stat(fullPath);
          const fileSize = stats.size;
          totalSize += fileSize;
          let isSkipped = false;
          let skipReason = "";
          const binaryCheck = await isFileBinary(fullPath, detectionOptions);
          if (binaryCheck.isBinary) {
            isSkipped = true;
            skipReason = binaryCheck.details || "Binary file";
            if (binaryCheck.reason === "size") {
              sizeSkippedCount++;
            } else {
              binaryCount++;
            }
            skippedCount++;
          }
          let tokenEstimate = 0;
          if (!isSkipped) {
            try {
              const content = await fs.promises.readFile(fullPath, "utf8");
              tokenEstimate = estimateTokens(content);
              totalTokens += tokenEstimate;
            } catch (readError) {
              isSkipped = true;
              skipReason = "Failed to read as text";
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
    console.error("Error fetching directory children:", error);
    return {
      children: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
});
electron.ipcMain.handle("clipboard:writePrompt", async (_, payload) => {
  try {
    electron.clipboard.writeText(payload);
    return { success: true };
  } catch (error) {
    console.error("Error writing to clipboard:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});
function registerIpcHandlers() {
  electron.ipcMain.handle("directory:lazyLoadChildren", async (event, dirPath, options = {}) => {
    console.log(`Lazy loading children for directory: ${dirPath}`);
    try {
      if (!fs.existsSync(dirPath)) {
        return { error: "Directory does not exist" };
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
      const children = [];
      const items = await fs.promises.readdir(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const relativePath = path.relative(rootPath, itemPath);
        if (ignoreManager.shouldIgnore(itemPath)) {
          continue;
        }
        try {
          const stats = await fs.promises.stat(itemPath);
          if (stats.isDirectory()) {
            children.push({
              path: itemPath,
              relativePath,
              size: 0,
              // Will be updated when directory is loaded
              isDirectory: true,
              isSkipped: false,
              tokenEstimate: 0,
              hasLazyChildren: true
              // Mark that this directory has unloaded children
            });
          } else {
            fileCount++;
            const fileSizeBytes = stats.size;
            let isSkipped = false;
            let skipReason = "";
            const binaryCheck = await isFileBinary(itemPath, binaryOptions);
            if (binaryCheck.isBinary) {
              isSkipped = true;
              skipReason = binaryCheck.details || "Binary file";
              if (binaryCheck.reason === "size") {
                sizeSkippedCount++;
              } else {
                binaryCount++;
              }
              skippedCount++;
            }
            let tokenEstimate = 0;
            if (!isSkipped) {
              try {
                const content = await fs.promises.readFile(itemPath, "utf8");
                tokenEstimate = estimateTokens(content);
                totalTokens += tokenEstimate;
              } catch (readError) {
                console.error(`Error reading file ${itemPath}:`, readError);
                isSkipped = true;
                skipReason = "Failed to read as text";
                binaryCount++;
                skippedCount++;
              }
            }
            totalSize += fileSizeBytes;
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
      };
    } catch (error) {
      console.error("Error in lazyLoadChildren:", error);
      return { error: "Failed to load directory children" };
    }
  });
  electron.ipcMain.handle("generate-payload-and-copy", async (_, selectedFiles) => {
    const MAX_TOKENS = 2e6;
    const WARN_TOKENS_THRESHOLD = 18e5;
    let currentTotalTokens = 0;
    let payload = "";
    let filesProcessedCount = 0;
    let allFilesProcessed = true;
    console.log("[Main] Received request to generate payload for an_array_of_selected_files_with_length:", selectedFiles.length);
    for (const file of selectedFiles) {
      if (file.isDirectory || file.isSkipped) {
        continue;
      }
      if (currentTotalTokens + file.tokenEstimate > MAX_TOKENS) {
        console.warn(`[Main] Token limit (${MAX_TOKENS}) reached. Stopping payload generation. Processed ${filesProcessedCount} files.`);
        allFilesProcessed = false;
        break;
      }
      try {
        const content = await fs.promises.readFile(file.path, "utf-8");
        payload += `<file_path>${file.relativePath}</file_path>
<file_contents>
${content}
</file_contents>

`;
        currentTotalTokens += file.tokenEstimate;
        filesProcessedCount++;
        if (currentTotalTokens > WARN_TOKENS_THRESHOLD && allFilesProcessed) {
          console.warn(`[Main] Payload approaching token limit. Current tokens: ${currentTotalTokens}`);
        }
      } catch (error) {
        console.error(`[Main] Error reading file ${file.path}:`, error);
      }
    }
    if (payload.length === 0 && selectedFiles.filter((f) => !f.isDirectory && !f.isSkipped).length > 0) {
      console.warn("[Main] No payload generated, possibly due to all selected files exceeding token limit individually or read errors.");
      return { success: false, message: "No content generated. Files might be too large or unreadable." };
    }
    if (payload.length > 0) {
      electron.clipboard.writeText(payload.trim());
      const message = allFilesProcessed ? `Successfully copied ${filesProcessedCount} files to clipboard.` : `Copied ${filesProcessedCount} files to clipboard. Token limit reached, some files may have been excluded.`;
      console.log(`[Main] ${message} Total tokens: ${currentTotalTokens}`);
      return { success: true, message, CANCELED_BECAUSE_TOO_LARGE_BOOLEAN: !allFilesProcessed, tokens: currentTotalTokens };
    }
    return { success: false, message: "No files selected or processed." };
  });
}
electron.app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
