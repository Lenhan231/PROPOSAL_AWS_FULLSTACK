import { useState } from 'react';
import { useAuth } from '../src/contexts/AuthContext';

// Disable static generation for this page (requires authentication)
export const config = {
  unstable_runtimeJS: true,
};

export default function TestUploadPage() {
  const { user, getIdToken } = useAuth();
  const [log, setLog] = useState([]);
  const [file, setFile] = useState(null);

  const addLog = (msg, type = 'info') => {
    console.log(msg);
    setLog(prev => [...prev, { msg, type, time: new Date().toISOString() }]);
  };

  const testUpload = async () => {
    if (!file) {
      addLog('Please select a file first', 'error');
      return;
    }

    try {
      setLog([]);
      addLog('Starting upload test...', 'info');
      
      // Get token
      const token = await getIdToken();
      if (!token) {
        addLog('Failed to get ID token', 'error');
        return;
      }
      addLog('✓ Got ID token: ' + token.substring(0, 20) + '...', 'success');

      // Request presigned URL
      addLog('Requesting presigned URL from API...', 'info');
      const apiUrl = process.env.NEXT_PUBLIC_UPLOAD_API || 'NOT_CONFIGURED';
      addLog('API URL: ' + apiUrl, 'info');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          title: 'Test Upload',
          author: 'Test Author',
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        addLog(`API request failed: ${response.status} - ${text}`, 'error');
        return;
      }

      const { uploadUrl, bookId } = await response.json();
      addLog('✓ Got presigned URL and bookId: ' + bookId, 'success');
      addLog('Upload URL host: ' + new URL(uploadUrl).host, 'info');

      // Test OPTIONS request (CORS preflight)
      addLog('Testing CORS preflight (OPTIONS)...', 'info');
      try {
        const optionsResponse = await fetch(uploadUrl, { method: 'OPTIONS' });
        addLog('✓ OPTIONS request status: ' + optionsResponse.status, 'success');
        addLog('CORS headers: ' + JSON.stringify({
          'access-control-allow-origin': optionsResponse.headers.get('access-control-allow-origin'),
          'access-control-allow-methods': optionsResponse.headers.get('access-control-allow-methods'),
          'access-control-allow-headers': optionsResponse.headers.get('access-control-allow-headers'),
        }), 'info');
      } catch (err) {
        addLog('⚠ OPTIONS request failed: ' + err.message, 'warning');
      }

      // Upload file
      addLog('Uploading file to S3...', 'info');
      
      // IMPORTANT: Create a new File/Blob without type to prevent browser from setting Content-Type
      const fileBlob = new Blob([file], { type: '' });
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: fileBlob,
        // Explicitly prevent Content-Type header
        headers: {},
      });

      if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        addLog(`Upload failed: ${uploadResponse.status} - ${text}`, 'error');
        return;
      }

      addLog('✓ Upload successful!', 'success');
    } catch (error) {
      addLog('Error: ' + error.message, 'error');
      addLog('Stack: ' + error.stack, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          Upload Debug Test
        </h1>

        {!user && (
          <div className="bg-yellow-100 p-4 rounded mb-4">
            <p className="text-yellow-800">Please login first: <a href="/login" className="underline">Login</a></p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
          <label className="block mb-4">
            <span className="text-gray-700 dark:text-gray-300">Select file:</span>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="mt-1 block w-full"
            />
          </label>
          <button
            onClick={testUpload}
            disabled={!file || !user}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Test Upload
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Log:</h2>
          <div className="space-y-2 font-mono text-sm max-h-96 overflow-y-auto">
            {log.map((entry, i) => (
              <div
                key={i}
                className={`p-2 rounded ${
                  entry.type === 'error'
                    ? 'bg-red-100 text-red-800'
                    : entry.type === 'success'
                    ? 'bg-green-100 text-green-800'
                    : entry.type === 'warning'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <span className="text-gray-500">[{new Date(entry.time).toLocaleTimeString()}]</span> {entry.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Force server-side rendering to avoid static export errors with AuthContext
export async function getServerSideProps() {
  return {
    props: {},
  };
}
