import React, { useEffect, useState } from 'react';
import { getTotalTokenCount, formatNumber } from '../utils/selectionUtils';
import { FileInfo } from '../types/common';
import clsx from 'clsx';

interface TokenCounterProps {
  selectedFiles: FileInfo[];
  tokenLimit: number;
  warningThreshold: number;
  className?: string;
}

export default function TokenCounter({ 
  selectedFiles, 
  tokenLimit, 
  warningThreshold,
  className
}: TokenCounterProps): JSX.Element {
  const [tokenCount, setTokenCount] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Calculate tokens
    const totalTokens = getTotalTokenCount(selectedFiles);
    const percentageUsed = (totalTokens / tokenLimit) * 100;
    
    // Update state
    setTokenCount(totalTokens);
    setPercentage(percentageUsed);
    
    // Add animation effect when value changes
    setAnimate(true);
    const timeout = setTimeout(() => setAnimate(false), 300);
    
    return () => clearTimeout(timeout);
  }, [selectedFiles, tokenLimit]);

  // Visual states based on token usage
  const isExceeding = percentage > 100;
  const isWarning = percentage >= warningThreshold && !isExceeding;
  
  return (
    <div className={clsx(
      "token-counter flex items-center text-sm font-medium rounded-md px-3 py-1.5 transition-all", 
      animate && "animate-pulse",
      isExceeding 
        ? "bg-red-900/40 text-red-300 border border-red-700/50" 
        : isWarning
          ? "bg-yellow-900/40 text-yellow-300 border border-yellow-700/50"
          : "bg-blue-900/40 text-blue-300 border border-blue-700/50",
      className
    )}>
      <div className="flex flex-col">
        <div className="flex items-center">
          <svg 
            className={clsx(
              "w-4 h-4 mr-1.5", 
              isExceeding ? "text-red-400" : isWarning ? "text-yellow-400" : "text-blue-400"
            )} 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
          <span className="whitespace-nowrap">
            {formatNumber(tokenCount)} / {formatNumber(tokenLimit)} tokens
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1.5">
          <div 
            className={clsx(
              "h-1.5 rounded-full transition-all duration-300 ease-in-out",
              isExceeding ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-blue-500"
            )} 
            style={{ width: `${Math.min(percentage, 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
} 