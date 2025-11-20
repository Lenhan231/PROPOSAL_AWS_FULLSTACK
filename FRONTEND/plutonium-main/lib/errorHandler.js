import { API_ERROR_CODES } from './constants';

/**
 * Handle API errors and return user-friendly messages
 * @param {Error} error - The error object from API call
 * @returns {string} User-friendly error message
 */
export function handleApiError(error) {
  // Network error (no response)
  if (!error.response) {
    if (error.request) {
      return 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
    }
    return error.message || 'Đã xảy ra lỗi không xác định.';
  }

  // Server responded with error
  const { data, status } = error.response;

  // If backend returns standard error format
  if (data && data.code) {
    return getErrorMessageByCode(data.code, data.error);
  }

  // Fallback to HTTP status
  return getErrorMessageByStatus(status);
}

/**
 * Get error message by error code
 */
function getErrorMessageByCode(code, defaultMessage) {
  const messages = {
    [API_ERROR_CODES.INVALID_REQUEST]: 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.',
    [API_ERROR_CODES.UNAUTHORIZED]: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    [API_ERROR_CODES.FORBIDDEN]: 'Bạn không có quyền thực hiện thao tác này.',
    [API_ERROR_CODES.NOT_FOUND]: 'Không tìm thấy tài nguyên yêu cầu.',
    [API_ERROR_CODES.FILE_TOO_LARGE]: 'File quá lớn. Kích thước tối đa là 50MB.',
    [API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE]: 'Chỉ chấp nhận file PDF hoặc ePub.',
    [API_ERROR_CODES.TOO_MANY_REQUESTS]: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
    [API_ERROR_CODES.INTERNAL_ERROR]: 'Lỗi hệ thống. Vui lòng thử lại sau.',
  };

  return messages[code] || defaultMessage || 'Đã xảy ra lỗi.';
}

/**
 * Get error message by HTTP status
 */
function getErrorMessageByStatus(status) {
  const messages = {
    400: 'Yêu cầu không hợp lệ.',
    401: 'Vui lòng đăng nhập để tiếp tục.',
    403: 'Bạn không có quyền truy cập.',
    404: 'Không tìm thấy tài nguyên.',
    413: 'File quá lớn.',
    415: 'Định dạng file không được hỗ trợ.',
    429: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
    500: 'Lỗi server. Vui lòng thử lại sau.',
    502: 'Server tạm thời không khả dụng.',
    503: 'Dịch vụ đang bảo trì.',
  };

  return messages[status] || `Lỗi ${status}. Vui lòng thử lại.`;
}

/**
 * Log error to console (development only)
 */
export function logError(error, context = '') {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error${context ? ` - ${context}` : ''}]:`, error);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

/**
 * Check if error is authentication error
 */
export function isAuthError(error) {
  if (!error.response) return false;
  
  const { status, data } = error.response;
  return status === 401 || data?.code === API_ERROR_CODES.UNAUTHORIZED;
}

/**
 * Check if error is permission error
 */
export function isPermissionError(error) {
  if (!error.response) return false;
  
  const { status, data } = error.response;
  return status === 403 || data?.code === API_ERROR_CODES.FORBIDDEN;
}
