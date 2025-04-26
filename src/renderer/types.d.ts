interface Window {
  api: {
    selectFolder: () => Promise<string | null>;
    verifyDroppedFolder: (path: string) => Promise<string | null>;
  };
} 