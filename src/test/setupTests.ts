import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock the clipboard API
Object.defineProperty(window.navigator, 'clipboard', {
  value: {
    writeText: vi.fn(),
    readText: vi.fn()
  },
  writable: true
});

// Mock the Electron IPC renderer
const mockApiCalls = {
  selectFolder: vi.fn(),
  verifyDroppedFolder: vi.fn(),
  walkDirectory: vi.fn(),
  lazyLoadChildren: vi.fn(),
  readFileContent: vi.fn(),
  checkBinaryStatus: vi.fn(),
  writeToClipboard: vi.fn(),
  onWalkProgress: vi.fn(() => vi.fn()), // Mock the event remover function
};

// Add window.api for the tests
(window as any).api = mockApiCalls;

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
}); 