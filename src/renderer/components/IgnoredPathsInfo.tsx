import React, { useState } from 'react';

interface IgnoredPathsInfoProps {
  rootPath: string;
}

export default function IgnoredPathsInfo({ rootPath }: IgnoredPathsInfoProps): JSX.Element {
  const [showDetails, setShowDetails] = useState(false);
  const [defaultPatterns] = useState(['node_modules/**', '.git/**']);

  return (
    <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Ignored Paths</h3>
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-blue-400 hover:underline"
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      </div>
      
      {showDetails && (
        <div className="mt-2">
          <p className="text-xs text-gray-400 mb-2">
            The following patterns are ignored from scan based on your .repopromptignore file:
          </p>
          <div className="text-xs bg-gray-900 p-2 rounded-md">
            {defaultPatterns.map((pattern, idx) => (
              <div key={idx} className="text-amber-400">{pattern}</div>
            ))}
            <div className="text-gray-500 italic mt-1">
              + any patterns defined in .repopromptignore
            </div>
          </div>
          
          <div className="mt-2 text-xs text-gray-400">
            <p>To customize ignored paths, create or edit .repopromptignore file in your project root.</p>
            <p className="mt-1">Each line should contain a glob pattern (e.g. build/**, *.log).</p>
          </div>
        </div>
      )}
    </div>
  );
} 