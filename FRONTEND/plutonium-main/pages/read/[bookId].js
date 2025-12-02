import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from 'next/dynamic';
import axios from 'axios';
import { api } from "../../lib/api";
import { API_ENDPOINTS } from "../../lib/constants";
import { useAuth } from "../../src/contexts/AuthContext";
import { fetchAuthSession } from 'aws-amplify/auth';

// Dynamically import ReactReader for EPUB support (only loads when needed)
const ReactReader = dynamic(() => import('react-reader').then(mod => mod.ReactReader), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><div className="text-gray-600">Loading EPUB reader...</div></div>
});

export default function ReadBookPage() {
  const router = useRouter();
  const { bookId, title, author, description, pages } = router.query;
  const normalizedBookId = Array.isArray(bookId) ? bookId[0] : bookId;
  const { user, loading: authLoading } = useAuth();
  const [contentUrl, setContentUrl] = useState(""); // Changed from pdfUrl to contentUrl
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookData, setBookData] = useState(
    // Use query params if available
    title && author ? {
      title,
      author,
      description: description || "",
      pages: pages || "N/A"
    } : null
  );
  const [fileType, setFileType] = useState(null); // 'pdf' or 'epub'
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(null); // null = checking, false = not admin, true = admin
  const [epubLocation, setEpubLocation] = useState(null); // For EPUB reading position
  const [epubBlob, setEpubBlob] = useState(null); // For EPUB blob data
  const [iframeError, setIframeError] = useState(false); // Track iframe load errors
  const iframeRef = useRef(null);

  const hasAdminGroup = (groups) => {
    if (!groups) return false;
    if (Array.isArray(groups)) return groups.includes('Admins');
    if (typeof groups === 'string') {
      try {
        const parsed = JSON.parse(groups);
        if (Array.isArray(parsed)) return parsed.includes('Admins');
      } catch (_) {
        // not JSON, fall through
      }
      return groups.split(',').map(g => g.trim()).includes('Admins') || groups.includes('Admins');
    }
    return false;
  };

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoading) return; // Wait until auth finishes

      try {
        const session = await fetchAuthSession();
        const accessToken = session.tokens?.accessToken;
        const idToken = session.tokens?.idToken;

        const tokenGroups = 
          accessToken?.payload?.['cognito:groups'] ||
          idToken?.payload?.['cognito:groups'];

        const adminEmails = ['nhanle221199@gmail.com'];

        const isAdminUser = 
          hasAdminGroup(tokenGroups) || 
          adminEmails.includes(user?.attributes?.email || user?.username || '');
        
        setIsAdmin(isAdminUser);
      } catch (error) {
        console.error('Error checking admin:', error);
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [user, authLoading]);

  const loadBookData = async () => {
    if (!normalizedBookId || isAdmin === null || authLoading) {
      console.log('⏳ Waiting for bookId or admin check...');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('📖 Loading book data for:', normalizedBookId);
      console.log('👤 User is admin:', isAdmin);
      console.log('🌐 API base URL:', process.env.NEXT_PUBLIC_API_URL || 'fallback/default');
      console.log('🛣️ Admin preview path:', API_ENDPOINTS.ADMIN_PREVIEW_URL(normalizedBookId));
      console.log('🛣️ Read URL path:', API_ENDPOINTS.GET_READ_URL(normalizedBookId));
      
      // Try admin preview first if user is admin, fallback to regular read URL
      let result;
      let usedAdminEndpoint = false;
      let adminEndpointFailed = false;
      
      if (isAdmin) {
        try {
          console.log('🔑 Attempting admin preview endpoint...');
          result = await api.getAdminPreviewUrl(normalizedBookId, { 
            responseContentDisposition: 'inline' 
          });
          usedAdminEndpoint = true;
          console.log('✅ Admin preview endpoint succeeded');
        } catch (adminErr) {
          console.warn('⚠️ Admin preview endpoint failed:', {
            status: adminErr.response?.status,
            message: adminErr.response?.data?.message || adminErr.message,
            url: adminErr.response?.config?.url,
            baseURL: adminErr.response?.config?.baseURL,
            params: adminErr.response?.config?.params
          });
          adminEndpointFailed = true;
          
          // Try fallback to regular read URL
          try {
            console.log('🔄 Trying fallback to regular read URL...');
            result = await api.getReadUrl(normalizedBookId, { 
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
            
            router.replace(`/read-error?bookId=${normalizedBookId}&isAdmin=true&reason=${errorReason}`);
            return;
          }
        }
      } else {
        // Regular user - use standard read URL
        console.log('👤 Using regular read URL for non-admin user');
        result = await api.getReadUrl(normalizedBookId, { 
          responseContentDisposition: 'inline' 
        });
        console.log('✅ Regular read URL succeeded');
      }
      
      const signedUrl = result.url || result.readUrl;
      
      console.log('📝 Full API Response:', result);
      console.log('📝 Received URL:', signedUrl ? 'Yes' : 'No');
      console.log('🌐 Browser:', navigator.userAgent);
      console.log('🔗 URL starts with:', signedUrl ? signedUrl.substring(0, 50) + '...' : 'N/A');
      
      if (signedUrl) {
        // Detect file type from URL, filename, or metadata
        const fileName = result.title || result.fileName || '';
        const urlLower = signedUrl.toLowerCase();
        const fileNameLower = fileName.toLowerCase();
        
        let detectedType = 'pdf'; // default
        if (urlLower.includes('.epub') || fileNameLower.includes('.epub')) {
          detectedType = 'epub';
        } else if (urlLower.includes('.pdf') || fileNameLower.includes('.pdf')) {
          detectedType = 'pdf';
        }
        
        console.log('📚 Detected file type:', detectedType);
        
        setFileType(detectedType);
        setContentUrl(signedUrl);
        
        // For EPUB files, try to fetch as blob for better compatibility
        // If CORS blocks it, ReactReader will try directly (may not work with S3)
        if (detectedType === 'epub') {
          console.log('📖 Attempting to fetch EPUB as blob...');
          try {
            const response = await axios.get(signedUrl, {
              responseType: 'blob',
              withCredentials: false,
              timeout: 10000,
              headers: {
                'Accept': 'application/epub+zip, application/octet-stream'
              }
            });
            setEpubBlob(response.data);
            console.log('✅ EPUB blob loaded successfully');
          } catch (epubFetchError) {
            console.warn('⚠️ Failed to fetch EPUB blob (likely CORS issue):', epubFetchError.message);
            console.log('💡 EPUB will try to load directly from URL (may not work)');
            // Don't set error here - let ReactReader try with the URL directly
            // If that fails, user can still download
            setEpubBlob('direct'); // Signal to use URL directly
          }
        }
        
        // Only update book data if not already set from query params
        if (!bookData || !bookData.title) {
          setBookData({
            title: result.title || result.bookTitle || result.name || "Unknown Title",
            author: result.author || result.bookAuthor || result.uploader || result.uploaderName || "Unknown Author",
            description: result.description || result.bookDescription || "",
            uploadDate: result.uploadDate || result.createdAt || result.uploadedAt || "",
            pages: result.pages || result.pageCount || "N/A"
          });
          console.log('✅ Book data set from API:', {
            title: result.title || result.bookTitle || result.name,
            author: result.author || result.bookAuthor || result.uploader
          });
        } else {
          console.log('✅ Using book data from query params:', bookData);
        }
        
        // Add direct link option for browsers that don't support iframe
        console.log('📖 If viewer doesn\'t load, open this URL directly:', signedUrl);
      } else {
        console.error('❌ No URL received from API');
        setError('No URL received from server');
        // No URL received - redirect to error page
        router.replace(`/read-error?bookId=${bookId}&isAdmin=${isAdmin}&reason=no_url`);
      }
    } catch (err) {
      console.error("❌ Failed to load book:", err);
      setError(err.message || 'Failed to load book');
      
      // Redirect to error page with context
      const errorReason = err.response?.status === 404 
        ? 'book_not_found' 
        : err.response?.status === 403 
        ? 'access_denied' 
        : 'unknown_error';
      
        router.replace(`/read-error?bookId=${normalizedBookId}&isAdmin=${isAdmin}&reason=${errorReason}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookData();
  }, [normalizedBookId, isAdmin]);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      
      // Get download URL - use admin preview if admin
      let result;
      if (isAdmin) {
        try {
          result = await api.getAdminPreviewUrl(normalizedBookId, { 
            responseContentDisposition: 'attachment' 
          });
        } catch (adminErr) {
          console.log('Admin download failed, trying regular read URL:', adminErr);
          result = await api.getReadUrl(normalizedBookId, { 
            responseContentDisposition: 'attachment' 
          });
        }
      } else {
        result = await api.getReadUrl(normalizedBookId, { 
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
            <div className="flex gap-2">
              {fileType === 'pdf' && (
                <a
                  href={contentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  title="Mở PDF trong tab mới"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="hidden sm:inline">Tab mới</span>
                </a>
              )}
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
                    <span className="hidden sm:inline">Đang tải...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="hidden sm:inline">Tải xuống</span>
                  </>
                )}
              </button>
            </div>
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

        {!loading && contentUrl && (
          <div className="space-y-6">
            {/* Book Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="w-32 h-44 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-5xl">
                    {fileType === 'epub' ? '📖' : '📚'}
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
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                    Bạn đang xem bản xem trước của cuốn sách này. Nhấn nút "Tải xuống" ở góc trên để tải toàn bộ sách về máy và đọc offline.
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 italic">
                    ⚠️ Lưu ý: Nếu trang tự động tải xuống sách thay vì hiển thị, vui lòng đóng file tải về và xem PDF trong khung hiển thị bên dưới. Đây là vấn đề tạm thời sẽ được khắc phục sớm.
                  </p>
                </div>
              </div>
            </div>

            {/* Book Viewer - PDF or EPUB */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="w-full" style={{ height: '800px' }}>
                {fileType === 'pdf' && (
                  <>
                    {!iframeError ? (
                      <iframe
                        ref={iframeRef}
                        src={contentUrl}
                        className="w-full h-full border-0"
                        title={bookData?.title}
                        allow="fullscreen"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        onError={(e) => {
                          console.error('❌ Iframe failed to load:', e);
                          console.log('🌐 Browser:', navigator.userAgent);
                          console.log('📋 PDF URL:', contentUrl);
                          setIframeError(true);
                        }}
                        onLoad={(e) => {
                          console.log('✅ Iframe loaded successfully');
                          // Check if iframe actually has content
                          try {
                            const iframeDoc = e.target.contentDocument || e.target.contentWindow?.document;
                            if (!iframeDoc || iframeDoc.body.innerHTML.trim() === '') {
                              console.warn('⚠️ Iframe loaded but appears empty');
                              setIframeError(true);
                            }
                          } catch (err) {
                            // Cross-origin restrictions prevent checking - assume it's okay
                            console.log('ℹ️ Cannot check iframe content (cross-origin)');
                          }
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50 dark:bg-gray-900">
                        <div className="text-center max-w-md">
                          <div className="text-6xl mb-4">🚫</div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Không thể hiển thị PDF
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Trình duyệt đang chặn hiển thị PDF. Vui lòng mở PDF trong tab mới hoặc tải xuống.
                          </p>
                          <div className="flex flex-col gap-3">
                            <a
                              href={contentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Mở trong Tab Mới
                            </a>
                            <button
                              onClick={handleDownload}
                              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Tải Xuống PDF
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                            Lỗi này thường xảy ra do cài đặt bảo mật của trình duyệt
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {fileType === 'epub' && (
                  <div className="w-full h-full">
                    {epubBlob && epubBlob !== 'direct' ? (
                      <ReactReader
                        url={epubBlob}
                        location={epubLocation}
                        locationChanged={(loc) => {
                          console.log('📍 EPUB location changed:', loc);
                          setEpubLocation(loc);
                        }}
                        title={bookData?.title}
                        showToc={true}
                        epubOptions={{
                          flow: "paginated",
                          manager: "default",
                        }}
                        readerStyles={{
                          ...{
                            arrow: {
                              color: '#3b82f6'
                            },
                            arrowHover: {
                              color: '#2563eb'
                            }
                          }
                        }}
                      />
                    ) : epubBlob === 'direct' ? (
                      <div className="flex flex-col items-center justify-center h-full p-8">
                        <div className="text-center max-w-md">
                          <div className="text-6xl mb-4">📖</div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            EPUB Không Thể Hiển Thị Trực Tuyến
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Do hạn chế bảo mật của S3, file EPUB không thể hiển thị trực tiếp trong trình duyệt. 
                            Vui lòng tải xuống để đọc trên thiết bị của bạn.
                          </p>
                          <button
                            onClick={handleDownload}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Tải Xuống EPUB
                          </button>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                            Bạn có thể đọc EPUB bằng: Apple Books, Google Play Books, Calibre, hoặc các ứng dụng đọc EPUB khác
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="inline-block w-12 h-12 mb-4 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                          <p className="text-gray-600 dark:text-gray-400">Đang tải EPUB...</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-400">
                <p className="mb-2">💡 <strong>Lưu ý:</strong> {fileType === 'pdf' ? 'Nếu PDF không hiển thị:' : 'Nếu EPUB không hiển thị:'}</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Thử trình duyệt khác (Chrome, Edge, Firefox)</li>
                  <li>Tắt ad blocker hoặc privacy extensions</li>
                  <li>Cho phép cookies của trang web này</li>
                  <li>Nhấn "Tải xuống" để xem offline</li>
                </ul>
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
