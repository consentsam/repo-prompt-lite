import React, { useState, useCallback } from 'react';

interface FolderPickerProps {
  onFolderSelected: (folderPath: string) => void;
}

export default function FolderPicker({ onFolderSelected }: FolderPickerProps): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    try {
      setErrorMessage(null);
      const selectedFolder = await window.api.selectFolder();
      if (selectedFolder) {
        setFolderPath(selectedFolder);
        onFolderSelected(selectedFolder);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      setErrorMessage('Error selecting folder. Please try again.');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only show the dragging UI if there's a directory being dragged
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setErrorMessage(null);

    const items = e.dataTransfer.items;
    
    if (items && items.length > 0) {
      // We only handle the first dropped item
      const item = items[0];
      
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        
        if (entry && entry.isDirectory) {
          try {
            // For macOS, we can try to get the actual file path
            const file = e.dataTransfer.files[0];
            const path = file.path;
            
            if (path) {
              // Verify the path exists and is a directory using the main process
              const verifiedPath = await window.api.verifyDroppedFolder(path);
              
              if (verifiedPath) {
                setFolderPath(verifiedPath);
                onFolderSelected(verifiedPath);
                return;
              }
            }
            
            // Fallback to just using the directory name if we can't get the full path
            setErrorMessage('Could not access the full folder path. Please use the Select Folder button instead.');
          } catch (error) {
            console.error('Error processing dropped folder:', error);
            setErrorMessage('Error processing dropped folder. Please try again or use the Select Folder button.');
          }
        } else {
          setErrorMessage('Please drop a folder, not a file.');
        }
      }
    }
  }, [onFolderSelected]);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div 
        className={`flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <svg 
          className="w-12 h-12 mb-4 text-gray-400" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" 
          />
        </svg>

        <p className="mb-2 text-lg font-medium text-gray-300">
          {folderPath ? 'Selected: ' + folderPath : 'Drag & drop folder here'}
        </p>
        
        <p className="mb-4 text-sm text-gray-500">or</p>
        
        <button
          onClick={handleSelectFolder}
          className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white font-medium"
        >
          Select Folder
        </button>
        
        {errorMessage && (
          <p className="mt-4 text-sm text-red-500">{errorMessage}</p>
        )}
      </div>
    </div>
  );
} 