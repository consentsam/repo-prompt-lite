import { contextBridge, ipcRenderer } from 'electron';
 
// Expose secure, whitelisted APIs to the renderer
contextBridge.exposeInMainWorld('api', {
  // Folder selection methods
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  verifyDroppedFolder: (path: string) => ipcRenderer.invoke('verify:droppedFolder', path),
  
  // Directory walker
  walkDirectory: (path: string) => ipcRenderer.invoke('directory:walk', path),
  
  // File operations
  readFileContent: (path: string) => ipcRenderer.invoke('file:readContent', path),
  
  // Clipboard operations
  writeToClipboard: (payload: string) => ipcRenderer.invoke('clipboard:writePrompt', payload),
  
  // Event listeners
  onWalkProgress: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('directory:walkProgress', listener);
    return () => {
      ipcRenderer.removeListener('directory:walkProgress', listener);
    };
  }
}); 