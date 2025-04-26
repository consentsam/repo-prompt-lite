# Manual Test Plan - Repo Prompt Lite

## Step 1.1 - Folder Picker Testing

### Prerequisites
- macOS system (primary target platform)
- Node.js and npm installed
- Repository cloned and dependencies installed

### Test Setup
1. Open terminal in project root
2. Run `npm run dev` to start the application
3. Wait for Electron window to appear

### Test Cases

#### TC1: Button-based Folder Selection
1. **Action**: Click the "Select Folder" button
2. **Expected**: Native macOS folder selection dialog opens
3. **Action**: Select a folder and click "Open"
4. **Expected**: Selected folder path appears in the UI
5. **Action**: Check browser console
6. **Expected**: Console shows "Selected folder: [path]" message

#### TC2: Button-based Selection Cancellation
1. **Action**: Click the "Select Folder" button
2. **Expected**: Native macOS folder selection dialog opens
3. **Action**: Click "Cancel" in the dialog
4. **Expected**: No change in UI, no folder path displayed if none was selected before

#### TC3: Drag-and-Drop Functionality
1. **Action**: Open Finder and navigate to a folder
2. **Action**: Drag the folder over the drop zone in the app
3. **Expected**: Drop zone highlights with blue border
4. **Action**: Drop the folder
5. **Expected**: Selected folder path appears in the UI

#### TC4: Error Handling - File Drop
1. **Action**: Open Finder and navigate to a file (not a folder)
2. **Action**: Drag the file over the drop zone
3. **Expected**: Drop zone highlights
4. **Action**: Drop the file
5. **Expected**: Error message appears: "Please drop a folder, not a file."

#### TC5: Security and Boundaries
1. **Action**: Try to access files outside the selected folder path
2. **Expected**: Not possible through the UI (will be tested more in Step 1.2)

### Verification Checklist
- [ ] All test cases pass
- [ ] UI is responsive and provides appropriate feedback
- [ ] Error messages are clear and helpful
- [ ] The app doesn't crash during any test
- [ ] Folder path is displayed correctly with proper truncation if very long

### Issues and Observations
*(Add any issues or observations found during testing here)* 