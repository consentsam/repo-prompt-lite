import React from 'react';
import { FileInfo } from '../types/common';
import { generateFileMap } from '../utils/formatUtils';

interface FileMapPreviewProps {
  selectedFiles: FileInfo[];
  rootFolderName?: string;
  allFiles?: FileInfo[];
}

/**
 * Component to preview the file map that will be generated
 */
export default function FileMapPreview({ selectedFiles, rootFolderName, allFiles }: FileMapPreviewProps): JSX.Element {
  // Generate the file map with all files but highlight selected ones
  const fileMap = generateFileMap(selectedFiles, rootFolderName, allFiles);
  
  // Split into lines to add line numbers
  const lines = fileMap.split('\n');
  
  return (
    <div className="mt-4">
      <h3 className="text-lg font-medium text-gray-200 mb-2">File Map Preview</h3>
      
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-auto">
        <pre className="p-4 text-sm font-mono text-gray-300 whitespace-pre">
          <code>
            &lt;file_map&gt;
            {lines.map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index < lines.length - 1 && '\n'}
              </React.Fragment>
            ))}
            &lt;/file_map&gt;
          </code>
        </pre>
      </div>
    </div>
  );
} 