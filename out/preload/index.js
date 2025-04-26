"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // Folder selection methods
  selectFolder: () => electron.ipcRenderer.invoke("dialog:openDirectory"),
  verifyDroppedFolder: (path) => electron.ipcRenderer.invoke("verify:droppedFolder", path),
  // Directory walker
  walkDirectory: (path) => electron.ipcRenderer.invoke("directory:walk", path),
  // File operations
  readFileContent: (path) => electron.ipcRenderer.invoke("file:readContent", path),
  // Clipboard operations
  writeToClipboard: (payload) => electron.ipcRenderer.invoke("clipboard:writePrompt", payload),
  // Event listeners
  onWalkProgress: (callback) => {
    const listener = (_, data) => callback(data);
    electron.ipcRenderer.on("directory:walkProgress", listener);
    return () => {
      electron.ipcRenderer.removeListener("directory:walkProgress", listener);
    };
  }
});
