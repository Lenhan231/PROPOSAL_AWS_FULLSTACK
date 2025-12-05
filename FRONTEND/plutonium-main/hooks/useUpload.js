import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { QUERY_KEYS, VALIDATION_RULES } from '../lib/constants';
import { handleApiError, logError } from '../lib/errorHandler';
import { toast } from '../store/uiStore';

/**
 * Hook to handle file upload flow
 */
export function useUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  // Step 1: Create upload URL
  const createUploadUrlMutation = useMutation({
    mutationFn: (data) => api.createUploadUrl(data),
    onError: (error) => {
      logError(error, 'createUploadUrl');
      toast.error(handleApiError(error));
    },
  });

  // Step 2: Upload to S3
  const uploadToS3Mutation = useMutation({
    mutationFn: ({ uploadUrl, file }) =>
      api.uploadToS3(uploadUrl, file, setUploadProgress),
    onSuccess: () => {
      // Invalidate my-uploads query
      queryClient.invalidateQueries([QUERY_KEYS.BOOKS, QUERY_KEYS.MY_UPLOADS]);
      toast.success('Upload thành công! Sách đang chờ duyệt.');
      setUploadProgress(0);
    },
    onError: (error) => {
      logError(error, 'uploadToS3');
      toast.error('Upload thất bại! Vui lòng thử lại.');
      setUploadProgress(0);
    },
  });

  // Combined upload function
  const upload = async (file, metadata) => {
    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }

      // Step 1: Get presigned URL
      const { uploadUrl, bookId } = await createUploadUrlMutation.mutateAsync({
        fileName: file.name,
        fileSize: file.size,
        ...metadata,
      });

      // Step 2: Upload to S3
      await uploadToS3Mutation.mutateAsync({ uploadUrl, file });

      return { success: true, bookId };
    } catch (error) {
      return { success: false, error };
    }
  };

  return {
    upload,
    uploadProgress,
    isUploading: createUploadUrlMutation.isLoading || uploadToS3Mutation.isLoading,
    error: createUploadUrlMutation.error || uploadToS3Mutation.error,
  };
}

/**
 * Validate file before upload
 */
function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'Vui lòng chọn file!' };
  }

  // Check file size
  if (file.size > VALIDATION_RULES.FILE.MAX_SIZE) {
    return {
      valid: false,
      error: `File quá lớn! Kích thước tối đa là ${VALIDATION_RULES.FILE.MAX_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = VALIDATION_RULES.FILE.ALLOWED_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext)
  );

  if (!hasValidExtension) {
    return {
      valid: false,
      error: 'Chỉ chấp nhận file PDF hoặc ePub!',
    };
  }

  return { valid: true };
}

/**
 * Validate upload metadata
 */
export function validateUploadMetadata(metadata) {
  const errors = {};

  // Title
  if (!metadata.title || metadata.title.trim().length < VALIDATION_RULES.TITLE.MIN_LENGTH) {
    errors.title = 'Vui lòng nhập tên sách!';
  } else if (metadata.title.length > VALIDATION_RULES.TITLE.MAX_LENGTH) {
    errors.title = `Tên sách tối đa ${VALIDATION_RULES.TITLE.MAX_LENGTH} ký tự!`;
  }

  // Author
  if (!metadata.author || metadata.author.trim().length < VALIDATION_RULES.AUTHOR.MIN_LENGTH) {
    errors.author = 'Vui lòng nhập tên tác giả!';
  } else if (metadata.author.length > VALIDATION_RULES.AUTHOR.MAX_LENGTH) {
    errors.author = `Tên tác giả tối đa ${VALIDATION_RULES.AUTHOR.MAX_LENGTH} ký tự!`;
  }

  // Description (optional)
  if (metadata.description && metadata.description.length > VALIDATION_RULES.DESCRIPTION.MAX_LENGTH) {
    errors.description = `Mô tả tối đa ${VALIDATION_RULES.DESCRIPTION.MAX_LENGTH} ký tự!`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
