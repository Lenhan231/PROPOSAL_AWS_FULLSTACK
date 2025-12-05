import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Toast from "../components/Toast";
import { api } from "../lib/api";

export default function MyUploadsPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  useEffect(() => {
    loadMyUploads();
  }, []);

  const loadMyUploads = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await api.getMyUploads();
      
      console.log("=== MY UPLOADS API RESPONSE ===");
      console.log("Books count:", result.books?.length || 0);
      
      // Log first book to see structure
      if (result.books && result.books.length > 0) {
        console.log("First book structure:", result.books[0]);
      }
      
      // Log rejected books to verify rejectedReason is now saved
      const rejectedBooks = (result.books || []).filter(b => b.status === 'REJECTED');
      if (rejectedBooks.length > 0) {
        console.log("=== REJECTED BOOKS (After backend fix) ===");
        rejectedBooks.forEach(book => {
          console.log(`Book "${book.title}" (${book.bookId}):`, {
            status: book.status,
            rejectedReason: book.rejectedReason,
            rejectedBy: book.rejectedBy,
            rejectedAt: book.rejectedAt
          });
        });
      }
      
      // Handle both possible response formats
      setUploads(result.books || result.uploads || result);
    } catch (err) {
      console.error("Failed to load uploads:", err);
      
      if (err.response?.status === 401) {
        router.push("/login");
      } else {
        const errorMsg = err.response?.data?.message || err.message || "Không thể tải danh sách sách";
        setError(errorMsg + ". Vui lòng thử lại sau.");
      }
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Head>
        <title>Sách của tôi - Thư Viện Online</title>
      </Head>
      <Header />

      <main className="px-4 py-12 mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Sách của tôi
          </h1>
          <button
            onClick={loadMyUploads}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="inline-block w-12 h-12 mb-4 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <p className="text-gray-600 dark:text-gray-400">Đang tải...</p>
            </div>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <div className="mb-4 text-6xl">😔</div>
            <p className="mb-4 text-xl text-gray-600 dark:text-gray-400">{error}</p>
            <button
              onClick={loadMyUploads}
              className="px-6 py-3 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Thử lại
            </button>
          </div>
        ) : uploads.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mb-4 text-6xl">📚</div>
            <p className="mb-4 text-xl text-gray-500 dark:text-gray-400">
              Bạn chưa tải lên sách nào
            </p>
            <Link
              href="/upload"
              className="inline-block px-6 py-3 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Tải lên sách đầu tiên
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {uploads.map((book) => (
              <UploadCard 
                key={book.bookId} 
                book={book} 
                onToast={showToast}
                onDelete={(bookId) => {
                  // Remove book from state immediately
                  setUploads(uploads.filter(b => b.bookId !== bookId));
                }}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
      
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
}

function UploadCard({ book, onToast, onDelete }) {
  const router = useRouter();

  const getDescriptionSnippet = (desc) => {
    if (!desc) return "Không có mô tả";
    return desc.length > 120 ? desc.slice(0, 117) + "..." : desc;
  };

  const getStatusBadge = (status) => {
    const badges = {
      UPLOADING: {
        text: "Tải lên lại",
        className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
        icon: "🔄"
      },
      PENDING: {
        text: "Chờ duyệt",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
        icon: "⏳"
      },
      APPROVED: {
        text: "Đã duyệt",
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
        icon: "✅"
      },
      REJECTED: {
        text: "Bị từ chối",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        icon: "❌"
      },
      REJECTED_INVALID_TYPE: {
        text: "File không hợp lệ",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        icon: "⚠️"
      },
    };

    const badge = badges[status] || badges.PENDING;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full ${badge.className}`}>
        <span>{badge.icon}</span>
        {badge.text}
      </span>
    );
  };

  const handleReadBook = () => {
    console.log('Book data being passed:', {
      bookId: book.bookId,
      title: book.title,
      author: book.author,
      description: book.description,
      pages: book.pages
    });
    
    router.push({
      pathname: `/read/${book.bookId}`,
      query: {
        title: book.title || '',
        author: book.author || '',
        description: book.description || '',
        pages: book.pages || ''
      }
    });
  };

  const handleDelete = async () => {
    if (!confirm(`Bạn có chắc muốn xóa sách "${book.title}"?\n\nSách sẽ bị xóa vĩnh viễn và không thể khôi phục.`)) {
      return;
    }

    try {
      await api.deleteBook(book.bookId);
      onToast(`Đã xóa sách "${book.title}"`, "success");
      
      // Remove from UI immediately without reload
      onDelete(book.bookId);
    } catch (err) {
      console.error("Failed to delete book:", err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || "Không thể xóa sách. Vui lòng thử lại.";
      onToast(errorMsg, "error");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {book.title}
            </h3>
            {getStatusBadge(book.status)}
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
              <span>📝</span>
              {getDescriptionSnippet(book.description)}
            </span>
          </div>
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            Tác giả: {book.author}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Tải lên: {formatDate(book.uploadedAt)}
          </p>

          {/* Additional Info */}
          {book.status === "APPROVED" && book.approvedAt && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              Đã duyệt: {formatDate(book.approvedAt)}
            </p>
          )}
          {book.status === "REJECTED" && (
            <div className="p-3 mt-2 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                ❌ Lý do từ chối:
              </p>
              <p className="text-sm text-red-700 dark:text-red-400">
                {book.rejectedReason || book.rejectionReason || book.rejection_reason || 
                  "Admin chưa ghi rõ lý do. Vui lòng liên hệ admin để biết thêm chi tiết."}
              </p>
              {book.rejectedAt && (
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                  Từ chối lúc: {formatDate(book.rejectedAt)}
                </p>
              )}
            </div>
          )}
          {book.status === "REJECTED_INVALID_TYPE" && (
            <div className="p-3 mt-2 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400">
                ⚠️ File không đúng định dạng PDF/ePub hoặc bị hỏng
              </p>
            </div>
          )}
          {book.status === "UPLOADING" && (
            <div className="p-3 mt-2 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-900/20 dark:border-orange-800">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                ⚠️ Lỗi: Traffic cao
              </p>
              <p className="mt-1 text-xs text-orange-700 dark:text-orange-400">
                Hệ thống đang quá tải. Vui lòng tải lại trang sau vài phút hoặc liên hệ admin.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {book.status === "APPROVED" && (
            <button
              onClick={handleReadBook}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Đọc sách
            </button>
          )}
          {book.status === "PENDING" && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-lg dark:bg-gray-700 dark:text-gray-400">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Đang chờ duyệt
            </div>
          )}
          {(book.status === "REJECTED" || book.status === "REJECTED_INVALID_TYPE" || book.status === "UPLOADING") && (
            <Link
              href="/upload"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Tải lên lại
            </Link>
          )}
          
          {/* Delete Button - Always show */}
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}
