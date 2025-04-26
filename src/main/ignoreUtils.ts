import fs from 'fs';
import path from 'path';

/**
 * Simple pattern matching for ignore files
 * @param path Path to check
 * @param pattern Pattern to match against
 */
function isMatch(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  let regexPattern = pattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*\*/g, '{{GLOBSTAR}}') // Temporarily replace ** with a placeholder
    .replace(/\*/g, '[^/]*') // Replace * with regex for any character except slash
    .replace(/\?/g, '[^/]') // Replace ? with regex for any character except slash
    .replace(/{{GLOBSTAR}}/g, '.*'); // Replace ** placeholder with regex for any character
  
  // Add start/end anchors if not already present
  if (!regexPattern.startsWith('^')) {
    regexPattern = '^' + regexPattern;
  }
  if (!regexPattern.endsWith('$')) {
    regexPattern += '$';
  }
  
  const regex = new RegExp(regexPattern);
  return regex.test(filePath);
}

/**
 * Class to handle .repopromptignore file patterns
 */
export class IgnoreManager {
  private ignorePatterns: string[] = [];
  private rootPath: string = '';
  private loaded: boolean = false;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  async loadIgnoreFile(): Promise<void> {
    try {
      const ignoreFilePath = path.join(this.rootPath, '.repopromptignore');
      
      // Check if the file exists
      try {
        await fs.promises.access(ignoreFilePath);
      } catch {
        // If file doesn't exist, use default patterns
        this.ignorePatterns = ['node_modules/**', '.git/**'];
        this.loaded = true;
        return;
      }
      
      // Read and parse the ignore file
      const content = await fs.promises.readFile(ignoreFilePath, 'utf8');
      this.ignorePatterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')) // Skip empty lines and comments
        .map(pattern => {
          // Ensure patterns work with directory structure
          if (!pattern.includes('/') && !pattern.endsWith('/**')) {
            return `${pattern}/**`;
          }
          return pattern;
        });
      
      // Always include node_modules and .git by default if not specified
      if (!this.ignorePatterns.some(p => p.startsWith('node_modules'))) {
        this.ignorePatterns.push('node_modules/**');
      }
      if (!this.ignorePatterns.some(p => p.startsWith('.git'))) {
        this.ignorePatterns.push('.git/**');
      }
      
      this.loaded = true;
    } catch (error) {
      console.error('Error loading ignore file:', error);
      // Default to node_modules if there's an error
      this.ignorePatterns = ['node_modules/**', '.git/**'];
      this.loaded = true;
    }
  }

  shouldIgnore(filePath: string): boolean {
    if (!this.loaded) {
      throw new Error('Ignore patterns not loaded yet. Call loadIgnoreFile() first.');
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