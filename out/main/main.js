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
function isLikelyBinary(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const binaryExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".tiff",
    ".ico",
    ".pdf",
    ".zip",
    ".gz",
    ".tar",
    ".rar",
    ".7z",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".mp3",
    ".mp4",
    ".avi",
    ".mov",
    ".flv",
    ".wmv",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".bin",
    ".dat",
    ".db",
    ".sqlite",
    ".class",
    ".obj"
  ];
  return binaryExtensions.includes(extension);
}
function estimateTokens(content) {
  return Math.ceil(content.length / 4);
}
function createWindow() {
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
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.ipcMain.handle("dialog:openDirectory", async () => {
  const { canceled, filePaths } = await electron.dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select a folder to import"
  });
  if (canceled) {
    return null;
  }
  return filePaths[0];
});
electron.ipcMain.handle("verify:droppedFolder", async (_, folderPath) => {
  try {
    const stats = await fs.promises.stat(folderPath);
    if (stats.isDirectory()) {
      return folderPath;
    }
    return null;
  } catch (error) {
    console.error("Error verifying dropped folder:", error);
    return null;
  }
});
electron.ipcMain.handle("directory:walk", async (event, folderPath) => {
  const results = [];
  let fileCount = 0;
  let totalSize = 0;
  let totalTokens = 0;
  const ONE_MB = 1024 * 1024;
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
            const shouldSkip = isLikelyBinary(fullPath) || fileSize >= ONE_MB;
            let tokenEstimate = 0;
            if (!shouldSkip) {
              try {
                const content = await fs.promises.readFile(fullPath, "utf8");
                tokenEstimate = estimateTokens(content);
                totalTokens += tokenEstimate;
              } catch (readError) {
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
    event.sender.send("directory:walkProgress", {
      fileCount,
      totalSize,
      totalTokens,
      processing: "Complete",
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
    console.error("Error walking directory:", error);
    event.sender.send("directory:walkProgress", {
      error: true,
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
});
electron.ipcMain.handle("file:readContent", async (_, filePath) => {
  try {
    const dirPath = path.dirname(filePath);
    const ignoreManager = new IgnoreManager(dirPath);
    await ignoreManager.loadIgnoreFile();
    if (ignoreManager.shouldIgnore(filePath)) {
      return {
        content: "",
        error: "File is in an ignored directory",
        isSkipped: true
      };
    }
    const stats = await fs.promises.stat(filePath);
    const ONE_MB = 1024 * 1024;
    if (isLikelyBinary(filePath) || stats.size >= ONE_MB) {
      return {
        content: "",
        error: "File is binary or too large",
        isSkipped: true
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
      isSkipped: true
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
electron.app.whenReady().then(createWindow);
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
