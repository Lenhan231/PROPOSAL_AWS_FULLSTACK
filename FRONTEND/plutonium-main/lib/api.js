import axios from 'axios';
import { API_ENDPOINTS } from './constants';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_BASE;

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

if (!process.env.NEXT_PUBLIC_API_URL && typeof window !== 'undefined') {
  console.warn('[API] NEXT_PUBLIC_API_URL missing, using fallback:', API_BASE_URL);
} else if (typeof window !== 'undefined') {
  console.log('[API] Using baseURL:', API_BASE_URL);
}

// Store for auth token getter (will be set by AuthContext)
let getAccessToken = null;

export const setTokenGetter = (getter) => {
  getAccessToken = getter;
};

// Request interceptor - Add JWT token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      if (getAccessToken) {
        const token = await getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error('Failed to get access token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Token will be refreshed automatically by Amplify
        if (getAccessToken) {
          const token = await getAccessToken();
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Normalize response header override params to the hyphenated form the backend expects
const normalizeResponseParams = (params = {}) => {
  const next = { ...params };
  if (params.responseContentDisposition && !params['response-content-disposition']) {
    next['response-content-disposition'] = params.responseContentDisposition;
  }
  if (params.responseContentType && !params['response-content-type']) {
    next['response-content-type'] = params.responseContentType;
  }
  delete next.responseContentDisposition;
  delete next.responseContentType;
  return next;
};

// ============================================
// API Methods
// ============================================

export const api = {
  // ========== Books ==========
  
  /**
   * Search books by query string
   * @param {Object} params - { q?: string, limit?: number }
   */
  searchBooks: async (params) => {
    const response = await apiClient.get(API_ENDPOINTS.SEARCH_BOOKS, { params });
    return response.data;
  },

  /**
   * Get read URL for a book
   * @param {string} bookId
   * @param {Object} params - Optional query parameters (e.g., { responseContentDisposition: 'inline' })
 */
  getReadUrl: async (bookId, params = {}) => {
    const normalized = normalizeResponseParams(params);
    if (typeof window !== 'undefined') {
      console.log('[API] GET read-url', API_ENDPOINTS.GET_READ_URL(bookId), 'base:', API_BASE_URL, 'params:', normalized);
    }
    const response = await apiClient.get(API_ENDPOINTS.GET_READ_URL(bookId), { params: normalized });
    return response.data;
  },

  /**
   * Get user's uploads
   * @param {Object} params - { page?: number, pageSize?: number }
   */
  getMyUploads: async (params) => {
    const response = await apiClient.get(API_ENDPOINTS.MY_UPLOADS, { params });
    return response.data;
  },

  /**
   * Delete a book (Owner or Admin only)
   * @param {string} bookId
   */
  deleteBook: async (bookId) => {
    const response = await apiClient.delete(API_ENDPOINTS.DELETE_BOOK(bookId));
    return response.data;
  },

  // ========== Upload ==========
  
  /**
   * Create upload URL (Step 1 of upload)
   * @param {Object} data - { fileName, fileSize, title, author, description? }
   */
  createUploadUrl: async (data) => {
    const response = await apiClient.post(API_ENDPOINTS.CREATE_UPLOAD_URL, data);
    return response.data;
  },

  /**
   * Upload file to S3 (Step 2 of upload)
   * @param {string} uploadUrl - Presigned PUT URL
   * @param {File} file - File object
   * @param {Function} onProgress - Progress callback
   */
  uploadToS3: async (uploadUrl, file, onProgress) => {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },

  // ========== Admin ==========
  
  /**
   * Get pending books (Admin only)
   * @param {Object} params - { page?: number, pageSize?: number }
   */
  getPendingBooks: async (params) => {
    const response = await apiClient.get(API_ENDPOINTS.PENDING_BOOKS, { params });
    return response.data;
  },

  /**
   * Get preview URL for pending book (Admin only)
   * @param {string} bookId
   * @param {Object} params - Optional query parameters (e.g., { responseContentDisposition: 'inline' })
  */
  getAdminPreviewUrl: async (bookId, params = {}) => {
    const normalized = normalizeResponseParams(params);
    if (typeof window !== 'undefined') {
      console.log('[API] GET admin preview', API_ENDPOINTS.ADMIN_PREVIEW_URL(bookId), 'base:', API_BASE_URL, 'params:', normalized);
    }
    const response = await apiClient.get(API_ENDPOINTS.ADMIN_PREVIEW_URL(bookId), { params: normalized });
    return response.data;
  },

  /**
   * Approve a book (Admin only)
   * @param {string} bookId
   */
  approveBook: async (bookId) => {
    const response = await apiClient.post(API_ENDPOINTS.APPROVE_BOOK(bookId));
    return response.data;
  },

  /**
   * Reject a book (Admin only)
   * @param {string} bookId
   * @param {string} reason
   */
  rejectBook: async (bookId, reason) => {
    console.log("=== REJECT BOOK API CALL ===");
    console.log("Book ID:", bookId);
    console.log("Reason:", reason);
    console.log("Endpoint:", API_ENDPOINTS.REJECT_BOOK(bookId));
    
    // Try with multiple field names in case backend expects different name
    const payload = {
      reason: reason,
      rejectionReason: reason,
      rejectedReason: reason
    };
    console.log("Payload:", payload);
    
    const response = await apiClient.post(API_ENDPOINTS.REJECT_BOOK(bookId), payload);
    console.log("Response:", response.data);
    return response.data;
  },
};

export default apiClient;
