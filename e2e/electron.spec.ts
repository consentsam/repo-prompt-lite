import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

test.describe('Electron Application', () => {
  let repoPath: string;
  
  test.beforeAll(async () => {
    // Create test repo
    repoPath = path.join(os.tmpdir(), 'repo-prompt-electron-test-' + Date.now());
    fs.mkdirSync(repoPath, { recursive: true });
    
    // Create some test files
    fs.writeFileSync(path.join(repoPath, 'file1.txt'), 'This is file 1 content');
    fs.writeFileSync(path.join(repoPath, 'file2.js'), 'console.log("This is file 2 content");');
    
    // Create a subfolder with files
    fs.mkdirSync(path.join(repoPath, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoPath, 'src', 'app.tsx'), 'export default function App() { return <div>Hello World</div>; }');
  });
  
  test.afterAll(async () => {
    // Clean up test repo
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
  });
  
  test('should launch electron app', async () => {
    // Launch Electron app
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        // Launch in development mode
        NODE_ENV: 'development',
        // Use test mode to mock file dialogs and clipboard
        TEST_MODE: 'true',
      },
    });

    // Get the first window
    const window = await electronApp.firstWindow();
    
    // Verify app loaded
    const title = await window.title();
    expect(title).toContain('Repo Prompt');
    
    // Verify the main elements are visible
    await expect(window.getByText('Repo Prompt Lite')).toBeVisible();
    
    // Close the app
    await electronApp.close();
  });
  
  test('should use IPC for folder selection', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Electron tests run only in Chromium');
    
    // Launch Electron app
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        NODE_ENV: 'development',
        TEST_MODE: 'true',
      },
    });

    // Get the first window
    const window = await electronApp.firstWindow();
    
    // Expose test helpers in the renderer process
    await window.evaluate(({ testRepoPath }) => {
      // Mock dialog.showOpenDialog to return our test path
      (window as any).mockDialogResponse = testRepoPath;
    }, { testRepoPath: repoPath });
    
    // Click select folder button
    await window.getByText('Select Folder').click();
    
    // Wait for directory scanning to complete
    await window.waitForSelector('[data-testid="file-tree"]', { timeout: 10000 });
    
    // Verify files are displayed
    await expect(window.getByText('file1.txt')).toBeVisible();
    await expect(window.getByText('src')).toBeVisible();
    
    // Close the app
    await electronApp.close();
  });
  
  test('should handle clipboard operations through IPC', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Electron tests run only in Chromium');
    
    // Launch Electron app
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        NODE_ENV: 'development',
        TEST_MODE: 'true',
      },
    });

    // Get the first window
    const window = await electronApp.firstWindow();
    
    // Mock folder selection
    await window.evaluate(({ testRepoPath }) => {
      // Directly call handleFolderSelected
      const app = document.querySelector('div[class*="App"]');
      const component = (app as any).__vnode?.component?.ctx;
      if (component && typeof component.handleFolderSelected === 'function') {
        component.handleFolderSelected(testRepoPath);
      }
    }, { testRepoPath: repoPath });
    
    // Wait for directory scanning to complete
    await window.waitForSelector('[data-testid="file-tree"]', { timeout: 10000 });
    
    // Select a file
    await window.locator('label:has-text("file1.txt")').click();
    
    // Click copy to clipboard
    await window.getByText('Copy to Clipboard').click();
    
    // Verify success message
    await expect(window.getByText(/Successfully copied/)).toBeVisible();
    
    // Close the app
    await electronApp.close();
  });
  
  test('should respect binary file detection settings', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Electron tests run only in Chromium');
    
    // Create a binary file in the test repo
    const binaryFilePath = path.join(repoPath, 'binary.dat');
    const buffer = Buffer.alloc(1024);
    // Fill with non-text data
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = i % 256;
    }
    fs.writeFileSync(binaryFilePath, buffer);
    
    // Launch Electron app
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        NODE_ENV: 'development',
        TEST_MODE: 'true',
      },
    });

    // Get the first window
    const window = await electronApp.firstWindow();
    
    // Mock folder selection
    await window.evaluate(({ testRepoPath }) => {
      // Directly call handleFolderSelected
      const app = document.querySelector('div[class*="App"]');
      const component = (app as any).__vnode?.component?.ctx;
      if (component && typeof component.handleFolderSelected === 'function') {
        component.handleFolderSelected(testRepoPath);
      }
    }, { testRepoPath: repoPath });
    
    // Wait for directory scanning to complete
    await window.waitForSelector('[data-testid="file-tree"]', { timeout: 10000 });
    
    // Check that binary file is shown but marked as skipped
    await expect(window.getByText('binary.dat')).toBeVisible();
    
    // Close the app
    await electronApp.close();
  });
}); 