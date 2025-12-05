import { useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../src/contexts/AuthContext';
import { getUploadUrl, uploadToS3 } from '../lib/uploadClient';

// Disable static generation for this page (requires authentication)
export const config = {
  unstable_runtimeJS: true,
};

export default function UploadPage() {
  const { user, getIdToken } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files && e.target.files[0];
    if (selectedFile) {
      // Validate file size (50MB)
      if (selectedFile.size > 50 * 1024 * 1024) {
        alert('File quá lớn! Kích thước tối đa là 50MB');
        return;
      }
      // Validate file type
      const validTypes = ['.pdf', '.epub'];
      const fileExt = selectedFile.name
        .toLowerCase()
        .slice(selectedFile.name.lastIndexOf('.'));
      if (!validTypes.includes(fileExt)) {
        alert('Chỉ chấp nhận file PDF hoặc ePub!');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      alert('Vui lòng chọn file!');
      return;
    }

    if (!formData.title || !formData.author || !formData.description) {
      alert('Vui lòng điền đầy đủ thông tin (bao gồm mô tả sách)!');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Check if user is logged in
      if (!user) {
        alert('Vui lòng đăng nhập trước khi tải lên!');
        return;
      }

      // Get ID token from AuthContext
      const idToken = await getIdToken();
      if (!idToken) {
        alert('Không thể lấy token xác thực. Vui lòng đăng nhập lại!');
        return;
      }

      console.log('Using ID token for upload request');
      console.log('File details:', { name: file.name, size: file.size, type: file.type });

      const uploadData = {
        title: formData.title,
        author: formData.author,
        description: formData.description,
        fileName: file.name,
        fileSize: file.size,
      };
      
      console.log('=== UPLOAD DATA SENT TO BACKEND ===');
      console.log('Upload data:', uploadData);
      console.log('Description:', formData.description);

      // Step 1: Request presigned URL from backend
      const { uploadUrl, bookId } = await getUploadUrl(idToken, uploadData);

      console.log('Got presigned URL, uploading to S3...', { bookId, uploadUrl: uploadUrl.substring(0, 100) + '...' });

      // Step 2: PUT file to S3 via presigned URL with progress
      await uploadToS3(uploadUrl, file, {
        onProgress: (loaded, total) => {
          const pct = total ? Math.round((loaded / total) * 100) : 0;
          setUploadProgress(pct);
        },
      });

      console.log('Upload to S3 completed successfully');
      alert('Upload thành công! Sách của bạn đang chờ được duyệt. Mã sách: ' + (bookId || ''));

      // Reset form
      setFormData({ title: '', author: '', description: '' });
      setFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error('Upload error details:', {
        message: error.message,
        status: error.status,
        stack: error.stack,
      });
      
      let errorMsg = 'Upload thất bại! ';
      if (error.message.includes('network error')) {
        errorMsg += 'Lỗi kết nối mạng hoặc CORS. Kiểm tra console để biết chi tiết.';
      } else if (error.status === 403) {
        errorMsg += 'Không có quyền upload (presigned URL có thể đã hết hạn).';
      } else {
        errorMsg += error.message;
      }
      
      alert(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Head>
        <title>Tải lên sách - Thư Viện Online</title>
      </Head>
      <Header />

      <main className="px-4 py-12 mx-auto max-w-3xl">
        <h1 className="mb-8 text-4xl font-bold text-center text-gray-900 dark:text-white">
          Tải lên tài liệu
        </h1>

        {!user && (
          <div className="p-6 mb-6 bg-yellow-50 border border-yellow-200 rounded-xl dark:bg-yellow-900/20 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Bạn cần <a href="/login" className="underline font-semibold">đăng nhập</a> để tải lên tài liệu.
            </p>
          </div>
        )}

        <div className="p-8 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Chọn file (PDF hoặc ePub) *
              </label>
              <input
                type="file"
                accept=".pdf,.epub"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Đã chọn: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Kích thước tối đa: 50MB</p>
            </div>

            {/* Title */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Tên sách *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập tên sách..."
                required
              />
            </div>

            {/* Author */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Tác giả *
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="w-full px-4 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập tên tác giả..."
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Mô tả <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                required
                className="w-full px-4 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập mô tả về sách (bắt buộc)..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Viết vài dòng giới thiệu về nội dung, chủ đề, hoặc điểm nổi bật của sách
              </p>
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                  Đang tải lên... {uploadProgress}%
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uploading}
              className="w-full px-6 py-3 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? `Đang tải lên... ${uploadProgress}%` : 'Tải lên'}
            </button>
          </form>
        </div>

        {/* Info Box */}
        <div className="p-6 mt-8 bg-blue-50 border border-blue-200 rounded-xl dark:bg-gray-800 dark:border-blue-900">
          <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-300">Lưu ý:</h3>
          <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200 list-disc list-inside">
            <li>Sách của bạn sẽ được kiểm duyệt trước khi xuất bản</li>
            <li>Chỉ tải lên tài liệu bạn có quyền chia sẻ</li>
            <li>Không tải lên nội dung vi phạm bản quyền</li>
          </ul>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Force server-side rendering to avoid static export errors with AuthContext

