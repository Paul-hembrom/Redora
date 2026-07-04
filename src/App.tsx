import React from 'react';

export default function App() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Files Missing</h1>
        <p className="text-gray-700 mb-4">
          The source code for your application (Readora) appears to have been deleted or lost, leaving the directory empty.
        </p>
        <p className="text-gray-600 text-sm">
          I have recreated the core configuration (package.json) to fix the npm install errors and restore the server. However, the application logic itself is missing. Please let me know if you would like to rebuild the features from scratch.
        </p>
      </div>
    </div>
  );
}
