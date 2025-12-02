import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function ReadErrorPage() {
  const router = useRouter();
  const { bookId, isAdmin, reason } = router.query;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isAdminPreview = isAdmin === 'true';
  const errorReason = reason || 'unknown';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-red-100 dark:from-gray-900 dark:via-red-900 dark:to-gray-900">
      <Head>
        <title>Không thể tải sách - Online Library</title>
      </Head>
      
      <Header />

      <div className="container mx-auto px-4 py-12 min-h-screen flex items-center justify-center">
        <div className="max-w-4xl w-full">
          {/* Error Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border-4 border-red-500">
            
            {/* Header Section */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-8 text-white text-center">
              <div className="text-8xl mb-4 animate-bounce">⚠️</div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                Không thể tải sách
              </h1>
              <p className="text-xl opacity-90">
                {isAdminPreview ? 'Admin Preview Error' : 'Book Loading Failed'}
              </p>
            </div>

            {/* Content Section */}
            <div className="p-8 md:p-12 space-y-8">
              
              {/* Admin-specific message */}
              {isAdminPreview && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 rounded-xl p-6">
                  <div className="flex items-start space-x-4">
                    <div className="text-4xl">👨‍💼</div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-3">
                        Thông báo cho Admin
                      </h2>
                      <p className="text-lg text-yellow-900 dark:text-yellow-100 mb-4">
                        Backend chưa có endpoint preview cho admin. Bạn đang cố preview một sách ở trạng thái <span className="font-bold">PENDING</span>.
                      </p>
                      
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-yellow-300">
                        <p className="font-mono text-sm text-gray-700 dark:text-gray-300 mb-2">
                          <span className="font-bold text-red-600">Missing Endpoint:</span>
                        </p>
                        <code className="block bg-gray-100 dark:bg-gray-900 p-3 rounded text-sm font-mono text-green-600 dark:text-green-400">
                          GET /admin/books/{bookId}/preview-url
                        </code>
                      </div>

                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                          🔧 Cần Backend Dev làm:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-yellow-900 dark:text-yellow-100">
                          <li>Tạo Lambda function cho endpoint trên</li>
                          <li>Generate presigned URL cho S3 (pending books)</li>
                          <li>Verify user là admin (cognito:groups)</li>
                          <li>Xem tài liệu: <code className="text-xs bg-yellow-200 dark:bg-yellow-800 px-1 rounded">BACKEND/ADMIN_PREVIEW_ENDPOINT.md</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* General error info */}
              {!isAdminPreview && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 rounded-xl p-6">
                  <div className="flex items-start space-x-4">
                    <div className="text-4xl">❌</div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-3">
                        Lỗi tải sách
                      </h2>
                      <p className="text-lg text-red-900 dark:text-red-100 mb-4">
                        Không thể tải nội dung sách. Có thể do:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-red-900 dark:text-red-100">
                        <li>Sách không tồn tại hoặc đã bị xóa</li>
                        <li>Sách chưa được duyệt (PENDING status)</li>
                        <li>Bạn không có quyền xem sách này</li>
                        <li>Lỗi kết nối backend</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Debug Info */}
              {bookId && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border-2 border-gray-300 dark:border-gray-600">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">
                    📋 Thông tin Debug
                  </h3>
                  <div className="space-y-2 text-sm font-mono">
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-bold">Book ID:</span> {bookId}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-bold">Is Admin:</span> {isAdmin || 'false'}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-bold">Error Reason:</span> {errorReason}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={() => router.back()}
                  className="flex-1 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold text-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  ← Quay lại
                </button>
                
                {isAdminPreview && (
                  <button
                    onClick={() => router.push('/admin/pending')}
                    className="flex-1 px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    📋 Admin Dashboard
                  </button>
                )}
                
                <button
                  onClick={() => router.push('/')}
                  className="flex-1 px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold text-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  🏠 Trang chủ
                </button>
              </div>

              {/* Help Section */}
              <div className="text-center pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Nếu vấn đề vẫn tiếp tục, vui lòng liên hệ admin hoặc thử lại sau.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
