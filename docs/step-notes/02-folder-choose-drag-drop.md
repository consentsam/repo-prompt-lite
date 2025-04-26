# 02-folder-choose-drag-drop

## What
- Created a `FolderPicker.tsx` component with both button-click and drag-drop functionality
- Implemented IPC communication between renderer and main process:
  - `selectFolder()` method using Electron's dialog API
  - `verifyDroppedFolder()` method to validate dropped folders
- Updated the preload script to expose these methods securely to the renderer
- Added TypeScript type definitions for the API
- Incorporated the FolderPicker component into the main App with state management
- Added error handling and user feedback for the folder selection process
- Fixed module type conflicts by removing `"type": "module"` from package.json to ensure compatibility with CommonJS configuration files

## Testing
- Manual testing by clicking the "Select Folder" button to open the native folder dialog
- Testing drag-drop functionality by dragging folders from Finder/Explorer
- Validating that both methods correctly display the selected folder path
- Ensuring error messages display when dropping files (instead of folders) or when path verification fails
- Confirming IPC methods are properly exposed through the preload script
- Fixed build error related to module type conflicts

## Troubleshooting
- Fixed an unterminated string literal error caused by module type conflicts
- Resolved by removing `"type": "module"` from package.json since our config files use CommonJS format
- Standardized on CommonJS by removing duplicate config files (deleted electron.vite.config.mjs)

## Follow-ups
- Implement directory walker in the main process to scan selected folders (Step 1.2)
- Add progress indicator during the folder scanning process
- Implement filtering logic for binary files and large files (≥ 1 MB)
- Calculate token estimates for files in the selected folder
- Consider adding folder path validation and display folder icon/information 