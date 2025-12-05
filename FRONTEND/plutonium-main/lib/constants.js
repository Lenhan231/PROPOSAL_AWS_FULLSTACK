// API Endpoints
export const API_ENDPOINTS = {
  // Auth (handled by Cognito)
  
  // Books
  SEARCH_BOOKS: '/books/search',
  GET_READ_URL: (bookId) => `/books/${bookId}/read-url`,
  MY_UPLOADS: '/books/my-uploads',
  DELETE_BOOK: (bookId) => `/books/${bookId}`,
  
  // Upload
  CREATE_UPLOAD_URL: '/books/upload-url',
  
  // Admin
  PENDING_BOOKS: '/admin/books/pending',
  ADMIN_PREVIEW_URL: (bookId) => `/admin/books/${bookId}/preview-url`,
  APPROVE_BOOK: (bookId) => `/admin/books/${bookId}/approve`,
  REJECT_BOOK: (bookId) => `/admin/books/${bookId}/reject`,
};

// Book Status
export const BOOK_STATUS = {
  UPLOADING: 'UPLOADING',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REJECTED_INVALID_TYPE: 'REJECTED_INVALID_TYPE',
};

// Status Badge Config
export const STATUS_BADGE_CONFIG = {
  [BOOK_STATUS.UPLOADING]: {
    text: 'Đang xử lý',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  },
  [BOOK_STATUS.PENDING]: {
    text: 'Chờ duyệt',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  },
  [BOOK_STATUS.APPROVED]: {
    text: 'Đã duyệt',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  [BOOK_STATUS.REJECTED]: {
    text: 'Bị từ chối',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
  [BOOK_STATUS.REJECTED_INVALID_TYPE]: {
    text: 'File không hợp lệ',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
};

// Validation Rules
export const VALIDATION_RULES = {
  FILE: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_EXTENSIONS: ['.pdf', '.epub'],
    ALLOWED_MIME_TYPES: ['application/pdf', 'application/epub+zip'],
  },
  TITLE: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 200,
  },
  AUTHOR: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  DESCRIPTION: {
    MAX_LENGTH: 1000,
  },
  REJECT_REASON: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 500,
  },
};

// Error Codes (from backend)
export const API_ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
};

// Query Keys (for TanStack Query)
export const QUERY_KEYS = {
  BOOKS: 'books',
  SEARCH: 'search',
  MY_UPLOADS: 'my-uploads',
  READ_URL: 'read-url',
  ADMIN_PENDING: 'admin-pending',
};
