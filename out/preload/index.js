"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  selectFolder: () => electron.ipcRenderer.invoke("dialog:openDirectory"),
  verifyDroppedFolder: (path) => electron.ipcRenderer.invoke("verify:droppedFolder", path),
  // Directory walker
  walkDirectory: (path, options) => electron.ipcRenderer.invoke("directory:walk", path, options),
  // Listen for scan progress
  onWalkProgress: (callback) => {
    const listener = (_, data) => callback(data);
    electron.ipcRenderer.on("directory:walkProgress", listener);
    return () => electron.ipcRenderer.removeListener("directory:walkProgress", listener);
  },
  // Lazy load directory children
  lazyLoadChildren: (path, options) => electron.ipcRenderer.invoke("directory:lazyLoadChildren", path, options),
  // File operations
  readFileContent: (path, options) => electron.ipcRenderer.invoke("file:readContent", path, options),
  checkBinaryStatus: (path, options) => electron.ipcRenderer.invoke("file:checkBinary", path, options),
  // Clipboard operations
  writeToClipboard: (payload) => electron.ipcRenderer.invoke("clipboard:writePrompt", payload)
});
