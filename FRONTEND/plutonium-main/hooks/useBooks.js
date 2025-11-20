import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { QUERY_KEYS, PAGINATION } from '../lib/constants';
import { handleApiError, logError } from '../lib/errorHandler';
import { toast } from '../store/uiStore';

/**
 * Hook to search books
 */
export function useSearchBooks(searchParams) {
  return useQuery({
    queryKey: [QUERY_KEYS.BOOKS, QUERY_KEYS.SEARCH, searchParams],
    queryFn: () => api.searchBooks(searchParams),
    enabled: !!(searchParams.title || searchParams.author),
    staleTime: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      logError(error, 'useSearchBooks');
    },
  });
}

/**
 * Hook to get read URL for a book
 */
export function useReadUrl(bookId) {
  return useQuery({
    queryKey: [QUERY_KEYS.BOOKS, bookId, QUERY_KEYS.READ_URL],
    queryFn: () => api.getReadUrl(bookId),
    enabled: !!bookId,
    staleTime: 50 * 60 * 1000, // 50 minutes (URL expires in 1 hour)
    onError: (error) => {
      logError(error, 'useReadUrl');
      toast.error(handleApiError(error));
    },
  });
}

/**
 * Hook to get user's uploads
 */
export function useMyUploads(params = {}) {
  const queryParams = {
    page: params.page || PAGINATION.DEFAULT_PAGE,
    pageSize: params.pageSize || PAGINATION.DEFAULT_PAGE_SIZE,
  };

  return useQuery({
    queryKey: [QUERY_KEYS.BOOKS, QUERY_KEYS.MY_UPLOADS, queryParams],
    queryFn: () => api.getMyUploads(queryParams),
    staleTime: 2 * 60 * 1000, // 2 minutes
    onError: (error) => {
      logError(error, 'useMyUploads');
    },
  });
}

/**
 * Hook to get pending books (Admin)
 */
export function usePendingBooks(params = {}) {
  const queryParams = {
    page: params.page || PAGINATION.DEFAULT_PAGE,
    pageSize: params.pageSize || PAGINATION.DEFAULT_PAGE_SIZE,
  };

  return useQuery({
    queryKey: [QUERY_KEYS.ADMIN_PENDING, queryParams],
    queryFn: () => api.getPendingBooks(queryParams),
    staleTime: 1 * 60 * 1000, // 1 minute
    onError: (error) => {
      logError(error, 'usePendingBooks');
    },
  });
}

/**
 * Hook to approve a book (Admin)
 */
export function useApproveBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookId) => api.approveBook(bookId),
    onSuccess: () => {
      // Invalidate pending books query
      queryClient.invalidateQueries([QUERY_KEYS.ADMIN_PENDING]);
      toast.success('Đã duyệt sách thành công!');
    },
    onError: (error) => {
      logError(error, 'useApproveBook');
      toast.error(handleApiError(error));
    },
  });
}

/**
 * Hook to reject a book (Admin)
 */
export function useRejectBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookId, reason }) => api.rejectBook(bookId, reason),
    onSuccess: () => {
      // Invalidate pending books query
      queryClient.invalidateQueries([QUERY_KEYS.ADMIN_PENDING]);
      toast.success('Đã từ chối sách!');
    },
    onError: (error) => {
      logError(error, 'useRejectBook');
      toast.error(handleApiError(error));
    },
  });
}
