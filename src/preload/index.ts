import { contextBridge, ipcRenderer } from 'electron';
 
// Expose secure, whitelisted APIs to the renderer
contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  verifyDroppedFolder: (path: string) => ipcRenderer.invoke('verify:droppedFolder', path),
  // Directory walker
  walkDirectory: (path: string, options?: any) => ipcRenderer.invoke('directory:walk', path, options),
  // Listen for scan progress
  onWalkProgress: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('directory:walkProgress', listener);
    return () => ipcRenderer.removeListener('directory:walkProgress', listener);
  },
  // Lazy load directory children
  lazyLoadChildren: (path: string, options?: any) => ipcRenderer.invoke('directory:lazyLoadChildren', path, options),
  // File operations
  readFileContent: (path: string, options?: any) => ipcRenderer.invoke('file:readContent', path, options),
  checkBinaryStatus: (path: string, options?: any) => ipcRenderer.invoke('file:checkBinary', path, options),
  // Clipboard operations
  writeToClipboard: (payload: string) => ipcRenderer.invoke('clipboard:writePrompt', payload),
  // Generate payload and copy to clipboard
  generatePayloadAndCopy: (
    selectedFiles: Array<{ path: string; relativePath: string; tokenEstimate: number; isDirectory: boolean; isSkipped: boolean }>
  ) => ipcRenderer.invoke('generate-payload-and-copy', selectedFiles)
}); 