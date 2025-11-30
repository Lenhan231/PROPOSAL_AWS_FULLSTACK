import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { api } from "../../lib/api";

export default function ReadBookPage() {
  const router = useRouter();
  const { bookId } = router.query;
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookTitle, setBookTitle] = useState("Đang tải...");

  useEffect(() => {
    if (bookId) {
      loadPdfUrl();
    }
  }, [bookId]);

  const loadPdfUrl = async () => {
    try {
      setLoading(true);
      setError("");
      
      const result = await api.getReadUrl(bookId, { 
        responseContentDisposition: 'inline' 
      });
      
      const signedUrl = result.url || result.readUrl;
      
      if (signedUrl) {
        setPdfUrl(signedUrl);
        setBookTitle(result.title || "Đọc sách");
      } else {
        setError("Không thể lấy URL đọc sách");
      }
    } catch (err) {
      console.error("Failed to load PDF:", err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      
      if (err.response?.status === 404) {
        setError("Sách không tồn tại hoặc chưa được duyệt");
      } else if (err.response?.status === 403) {
        setError("Bạn không có quyền đọc sách này");
      } else {
        setError(errorMsg || "Không thể tải sách");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Head>
        <title>{bookTitle} - Thư Viện Online</title>
      </Head>

      {/* Simple Header */}
      <header className="bg-white shadow-sm dark:bg-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
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
            {bookTitle}
          </h1>
          <div className="w-24"></div>
        </div>
      </header>

      {/* Content */}
      <main className="h-[calc(100vh-64px)]">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block w-12 h-12 mb-4 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <p className="text-gray-600 dark:text-gray-400">Đang tải sách...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="max-w-md p-6 text-center">
              <div className="mb-4 text-6xl">😔</div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                Không thể tải sách
              </h2>
              <p className="mb-4 text-gray-600 dark:text-gray-400">{error}</p>
              <button
                onClick={() => router.back()}
                className="px-6 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Quay lại
              </button>
            </div>
          </div>
        )}

        {!loading && !error && pdfUrl && (
          <object
            data={pdfUrl}
            type="application/pdf"
            className="w-full h-full border-0"
            title={bookTitle}
          >
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={bookTitle}
            />
          </object>
        )}
      </main>
    </div>
  );
}
