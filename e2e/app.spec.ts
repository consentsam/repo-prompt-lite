import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Helper to create a test repository
async function createTestRepo() {
  const repoPath = path.join(os.tmpdir(), 'repo-prompt-test-' + Date.now());
  fs.mkdirSync(repoPath, { recursive: true });
  
  // Create some test files
  fs.writeFileSync(path.join(repoPath, 'file1.txt'), 'This is file 1 content');
  fs.writeFileSync(path.join(repoPath, 'file2.js'), 'console.log("This is file 2 content");');
  
  // Create a subfolder with files
  fs.mkdirSync(path.join(repoPath, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoPath, 'src', 'app.tsx'), 'export default function App() { return <div>Hello World</div>; }');
  fs.writeFileSync(path.join(repoPath, 'src', 'index.ts'), 'import App from "./app";');
  
  return repoPath;
}

// Cleanup helper
async function removeTestRepo(repoPath: string) {
  try {
    if (fs.existsSync(repoPath)) {
      const deleteFolderRecursive = (folderPath: string) => {
        if (fs.existsSync(folderPath)) {
          fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
              deleteFolderRecursive(curPath);
            } else {
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(folderPath);
        }
      };
      deleteFolderRecursive(repoPath);
    }
  } catch (err) {
    console.error('Error cleaning up test repo:', err);
  }
}

// Test setup
test.describe('Repo Prompt App', () => {
  let repoPath: string;
  
  test.beforeAll(async () => {
    repoPath = await createTestRepo();
  });
  
  test.afterAll(async () => {
    await removeTestRepo(repoPath);
  });
  
  // Helper to set up the initial app state 
  async function setupInitialState(page: Page) {
    await page.goto('/');
    
    // Wait for the app to load
    await expect(page.getByText('Repo Prompt Lite')).toBeVisible();
    
    // Simulate folder selection (mock it since we can't use native file dialogs in E2E)
    await page.evaluate((testRepoPath) => {
      // Expose a function to set the selected folder
      (window as any).selectTestFolder = (path: string) => {
        // Call handleFolderSelected with the test repo path
        const app = document.querySelector('div[class*="App"]');
        const component = (app as any).__vnode?.component?.ctx;
        if (component && typeof component.handleFolderSelected === 'function') {
          component.handleFolderSelected(path);
        }
      };
      
      // Call the exposed function
      (window as any).selectTestFolder(testRepoPath);
    }, repoPath);
    
    // Wait for the directory scan to complete
    await page.waitForSelector('[data-testid="file-tree"]', { timeout: 5000 });
  }
  
  test('should load the app', async ({ page }) => {
    await page.goto('/');
    
    // Verify app title is displayed
    await expect(page.getByText('Repo Prompt Lite')).toBeVisible();
    await expect(page.getByText('Select a folder to generate code prompt')).toBeVisible();
  });
  
  test('should scan a directory when selected', async ({ page }) => {
    await setupInitialState(page);
    
    // Check if file tree is displayed
    await expect(page.locator('[data-testid="file-tree"]')).toBeVisible();
    
    // Check if specific files are displayed in the tree
    await expect(page.getByText('file1.txt')).toBeVisible();
    await expect(page.getByText('file2.js')).toBeVisible();
    await expect(page.getByText('src')).toBeVisible();
  });
  
  test('should select files and show toolbar', async ({ page }) => {
    await setupInitialState(page);
    
    // Select a file by clicking its checkbox
    await page.click('label:has-text("file1.txt")');
    
    // Toolbar should appear
    await expect(page.locator('[data-testid="toolbar"]')).toBeVisible();
    
    // Token counter should show the token count for the selected file
    await expect(page.getByText(/tokens/)).toBeVisible();
  });
  
  test('should expand and collapse folders', async ({ page }) => {
    await setupInitialState(page);
    
    // Src folder should be visible
    await expect(page.getByText('src')).toBeVisible();
    
    // Double-click to expand
    await page.dblclick('div:has-text("src")');
    
    // src contents should be visible
    await expect(page.getByText('app.tsx')).toBeVisible();
    await expect(page.getByText('index.ts')).toBeVisible();
    
    // Double-click again to collapse
    await page.dblclick('div:has-text("src")');
    
    // Contents should be hidden
    await expect(page.getByText('app.tsx')).not.toBeVisible();
  });
  
  test('should toggle between preview and stats', async ({ page }) => {
    await setupInitialState(page);
    
    // Select a file
    await page.click('label:has-text("file1.txt")');
    
    // Stats should be visible by default
    await expect(page.locator('[data-testid="selection-stats"]')).toBeVisible();
    
    // Click the Preview button
    await page.click('button:has-text("Preview")');
    
    // Preview should be visible and stats hidden
    await expect(page.locator('[data-testid="file-map-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="selection-stats"]')).not.toBeVisible();
    
    // Click the Stats button
    await page.click('button:has-text("Stats")');
    
    // Stats should be visible and preview hidden
    await expect(page.locator('[data-testid="selection-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-map-preview"]')).not.toBeVisible();
  });
  
  test('should copy to clipboard when button is clicked', async ({ page }) => {
    await setupInitialState(page);
    
    // Mock clipboard write permission and implementation
    await page.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.resolve();
      Object.defineProperty(navigator.clipboard, 'writeText', {
        value: () => Promise.resolve()
      });
    });
    
    // Select a file
    await page.click('label:has-text("file1.txt")');
    
    // Click copy button
    await page.click('button:has-text("Copy to Clipboard")');
    
    // Success message should appear
    await expect(page.getByText(/Successfully copied/)).toBeVisible();
  });
  
  test('should select all files when using toolbar button', async ({ page }) => {
    await setupInitialState(page);
    
    // No files selected initially
    await expect(page.locator('[data-testid="toolbar"]')).not.toBeVisible();
    
    // Click select all button (need to get it to appear first)
    await page.click('label:has-text("file1.txt")');
    await expect(page.locator('[data-testid="toolbar"]')).toBeVisible();
    
    // Click select all
    await page.click('button:has-text("Select All")');
    
    // All files should be selected (check token counter shows higher count)
    const tokenTextBefore = await page.locator('text=/[0-9]+ \/ [0-9,]+ tokens/').textContent();
    
    // Deselect all
    await page.click('button:has-text("Deselect All")');
    
    // Select just one file again
    await page.click('label:has-text("file1.txt")');
    const tokenTextAfter = await page.locator('text=/[0-9]+ \/ [0-9,]+ tokens/').textContent();
    
    // Token count should be different (lower after selecting just one file)
    expect(tokenTextBefore).not.toEqual(tokenTextAfter);
  });
}); 