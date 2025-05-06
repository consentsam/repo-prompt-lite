import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// In your App component or wherever you handle folder selection
const handleFolderSelection = async () => {
  console.log("Selecting folder...");
  const folderPath = await window.api.selectFolder();
  if (folderPath) {
    console.log("Folder selected:", folderPath);
    // Proceed with folder processing
  } else {
    console.error("Error selecting folder. Please try again.");
  }
}; 