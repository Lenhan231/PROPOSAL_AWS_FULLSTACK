import axios from 'axios';

// Base URL for API Gateway HTTP API (can move to env var NEXT_PUBLIC_API_BASE)
// Support both NEXT_PUBLIC_API_BASE and legacy NEXT_PUBLIC_API_BASE_URL (no hardcode link)
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  console.error('⚠️ API_BASE is not configured! Please set NEXT_PUBLIC_API_BASE or NEXT_PUBLIC_API_BASE_URL in .env.local');
}

/**
 * Request a presigned upload URL for a book/document.
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.author
 * @param {string} [params.description]
 * @param {File} params.file
 * @returns {Promise<{uploadUrl: string, objectKey: string}>}
 */
export async function requestUploadUrl({ title, author, description = '', file }) {
  if (!API_BASE) {
    throw new Error('API endpoint is not configured. Please check your environment variables.');
  }

  const body = {
    title,
    author,
    description,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || 'application/octet-stream'
  };

  console.log('📤 Requesting upload URL:', { endpoint: `${API_BASE}/books/upload-url`, fileName: file.name });

  try {
    const res = await axios.post(`${API_BASE}/books/upload-url`, body, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Upload URL received:', res.data);
    return res.data; // expect { uploadUrl, objectKey }
  } catch (error) {
    console.error('❌ Upload URL request failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      endpoint: `${API_BASE}/books/upload-url`
    });
    
    if (error.response) {
      // Server responded with error status
      throw new Error(`Server error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // Request made but no response (CORS, network, etc.)
      throw new Error('Network error: Cannot reach the API server. Please check CORS configuration or if the API is running.');
    } else {
      throw error;
    }
  }
}

/**
 * Upload file to S3 via the presigned URL.
 * @param {string} uploadUrl
 * @param {File|Blob} file
 * @param {(progress:number)=>void} onProgress
 */
export async function uploadFileToS3(uploadUrl, file, onProgress) {
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    },
    onUploadProgress: (evt) => {
      if (evt.total) {
        const pct = Math.round((evt.loaded * 100) / evt.total);
        onProgress?.(pct);
      }
    }
  });
}
