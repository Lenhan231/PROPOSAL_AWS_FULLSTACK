import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { api } from "../../lib/api";
import { useAuth } from "../../src/contexts/AuthContext";
import { fetchAuthSession } from 'aws-amplify/auth';

export default function ReadBookPage() {
  const router = useRouter();
  const { bookId } = router.query;
  const { user } = useAuth();
  const [pdfUrl, setPdfUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookData, setBookData] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(null); // null = checking, false = not admin, true = admin
  const iframeRef = useRef(null);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      
      try {
        const session = await fetchAuthSession();
        const accessToken = session.tokens?.accessToken;
        const idToken = session.tokens?.idToken;
        
        const tokenGroups = 
          accessToken?.payload?.['cognito:groups'] ||
          idToken?.payload?.['cognito:groups'];
        
        const adminEmails = ['nhanle221199@gmail.com'];
        
        const isAdminUser = 
          tokenGroups?.includes('Admins') || 
          adminEmails.includes(user?.attributes?.email || user?.username || '');
        
        setIsAdmin(isAdminUser);
      } catch (error) {
        console.error('Error checking admin:', error);
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (bookId && isAdmin !== null) { // Wait for admin check to complete
      loadBookData();
    }
  }, [bookId, isAdmin]);

  const loadBookData = async () => {
    try {
      setLoading(true);
      
      console.log('📖 Loading book data for:', bookId);
      console.log('👤 User is admin:', isAdmin);
      
      // Try admin preview first if user is admin, fallback to regular read URL
      let result;
      let usedAdminEndpoint = false;
      let adminEndpointFailed = false;
      
      if (isAdmin) {
        try {
          console.log('🔑 Attempting admin preview endpoint...');
          result = await api.getAdminPreviewUrl(bookId, { 
            responseContentDisposition: 'inline' 
          });
          usedAdminEndpoint = true;
          console.log('✅ Admin preview endpoint succeeded');
        } catch (adminErr) {
          console.warn('⚠️ Admin preview endpoint failed:', {
            status: adminErr.response?.status,
            message: adminErr.response?.data?.message || adminErr.message
          });
          adminEndpointFailed = true;
          
          // Try fallback to regular read URL
          try {
            console.log('🔄 Trying fallback to regular read URL...');
            result = await api.getReadUrl(bookId, { 
              responseContentDisposition: 'inline' 
            });
            console.log('✅ Regular read URL succeeded (fallback)');
          } catch (fallbackErr) {
            console.error('❌ Both endpoints failed');
            console.error('Admin preview error:', adminErr.response?.status, adminErr.response?.data);
            console.error('Regular read error:', fallbackErr.response?.status, fallbackErr.response?.data);
            
            // Redirect to dedicated error page for admin preview issues
            const errorReason = adminErr.response?.status === 404 
              ? 'admin_endpoint_not_found' 
              : 'admin_preview_failed';
            
            router.replace(`/read-error?bookId=${bookId}&isAdmin=true&reason=${errorReason}`);
            return;
          }
        }
      } else {
        // Regular user - use standard read URL
        console.log('👤 Using regular read URL for non-admin user');
        result = await api.getReadUrl(bookId, { 
          responseContentDisposition: 'inline' 
        });
        console.log('✅ Regular read URL succeeded');
      }
      
      const signedUrl = result.url || result.readUrl;
      
      if (signedUrl) {
        setPdfUrl(signedUrl);
        setBookData({
          title: result.title || "Đọc sách",
          author: result.author || "Không rõ",
          description: result.description || "",
          uploadDate: result.uploadDate || "",
          pages: result.pages || "N/A"
        });
      } else {
        // No URL received - redirect to error page
        router.replace(`/read-error?bookId=${bookId}&isAdmin=${isAdmin}&reason=no_url`);
      }
    } catch (err) {
      console.error("❌ Failed to load book:", err);
      
      // Redirect to error page with context
      const errorReason = err.response?.status === 404 
        ? 'book_not_found' 
        : err.response?.status === 403 
        ? 'access_denied' 
        : 'unknown_error';
      
      router.replace(`/read-error?bookId=${bookId}&isAdmin=${isAdmin}&reason=${errorReason}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      
      // Get download URL - use admin preview if admin
      let result;
      if (isAdmin) {
        try {
          result = await api.getAdminPreviewUrl(bookId, { 
            responseContentDisposition: 'attachment' 
          });
        } catch (adminErr) {
          console.log('Admin download failed, trying regular read URL:', adminErr);
          result = await api.getReadUrl(bookId, { 
            responseContentDisposition: 'attachment' 
          });
        }
      } else {
        result = await api.getReadUrl(bookId, { 
          responseContentDisposition: 'attachment' 
        });
      }
      
      const downloadUrl = result.url || result.readUrl;
      
      if (downloadUrl) {
        // Create temporary link and trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${bookData?.title || 'book'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert("Không thể tải xuống sách");
      }
    } catch (err) {
      console.error("Failed to download:", err);
      alert(err.response?.data?.message || "Không thể tải xuống sách");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Head>
        <title>{bookData?.title || "Đang tải..."} - Thư Viện Online</title>
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm dark:bg-gray-800 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-3 py-1.5 text-gray-700 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-md">
            {bookData?.title || "Đang tải..."}
          </h1>
          {!loading && !error && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-1.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang tải...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Tải xuống
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center min-h-[500px]">
            <div className="text-center">
              <div className="inline-block w-12 h-12 mb-4 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <p className="text-gray-600 dark:text-gray-400">Đang tải sách...</p>
            </div>
          </div>
        )}

        {!loading && pdfUrl && (
          <div className="space-y-6">
            {/* Book Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="w-32 h-44 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-5xl">
                    📚
                  </div>
                </div>
                <div className="flex-grow">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {bookData?.title}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    <span className="font-medium">Tác giả:</span> {bookData?.author}
                  </p>
                  {bookData?.description && (
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      {bookData.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-500">
                    {bookData?.uploadDate && (
                      <span>📅 {new Date(bookData.uploadDate).toLocaleDateString('vi-VN')}</span>
                    )}
                    {bookData?.pages && (
                      <span>📄 {bookData.pages} trang</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Xem trước sách
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Bạn đang xem bản xem trước của cuốn sách này. Nhấn nút "Tải xuống" ở góc trên để tải toàn bộ sách về máy và đọc offline.
                  </p>
                </div>
              </div>
            </div>

            {/* PDF Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="w-full" style={{ height: '800px' }}>
                <iframe
                  ref={iframeRef}
                  src={pdfUrl}
                  className="w-full h-full border-0"
                  title={bookData?.title}
                  allow="fullscreen"
                />
              </div>
            </div>

            {/* Download CTA */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-8 text-center text-white">
              <h2 className="text-2xl font-bold mb-2">Thích cuốn sách này?</h2>
              <p className="mb-6 text-blue-100">
                Tải xuống để đọc toàn bộ nội dung và lưu trữ trên thiết bị của bạn
              </p>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang tải xuống...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Tải xuống sách
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
