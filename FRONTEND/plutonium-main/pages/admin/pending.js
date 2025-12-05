import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import ProtectedRoute from "../../components/ProtectedRoute";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";
import { BOOK_STATUS } from "../../lib/constants";

export default function AdminPendingPage() {
  const [books, setBooks] = useState([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [rejectModal, setRejectModal] = useState({ show: false, bookId: null, title: "" });
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadPendingBooks();
    loadTotalBooks();
  }, []);

  const loadPendingBooks = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await api.getPendingBooks();
      console.log("=== ADMIN PENDING BOOKS ===");
      console.log("API Response:", result);
      console.log("Books count (raw):", result.books?.length || 0);
      
      // Filter client-side to only show PENDING books
      // Backend now includes status field (defaults to PENDING if missing)
      const pendingOnly = (result.books || []).filter(book => book.status === 'PENDING');
      console.log("Books count (filtered PENDING):", pendingOnly.length);
      
      if (pendingOnly.length !== result.books?.length) {
        console.warn("⚠️ Backend returned non-PENDING books! Filtering on client side.");
        const nonPending = result.books.filter(b => b.status !== 'PENDING');
        console.log("Non-PENDING books:", nonPending.map(b => ({ id: b.bookId, status: b.status, title: b.title })));
      }
      
      setBooks(pendingOnly);
    } catch (err) {
      console.error("Failed to load pending books:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      setError(err.response?.data?.message || "Không thể tải danh sách sách chờ duyệt");
    } finally {
      setLoading(false);
    }
  };

  const loadTotalBooks = async () => {
    try {
      // Get all approved books from search
      const result = await api.searchBooks({ limit: 100 });
      setTotalBooks(result.books?.length || 0);
    } catch (err) {
      console.error("Failed to load total books:", err);
      // Silent fail, just keep totalBooks as 0
    }
  };

  const handleApprove = async (bookId, title) => {
    if (!confirm(`Duyệt sách "${title}"?`)) return;

    try {
      await api.approveBook(bookId);
      showToast(`Đã duyệt sách "${title}"`, "success");
      // Reload entire list to ensure sync with backend
      await loadPendingBooks();
      await loadTotalBooks();
    } catch (err) {
      console.error("=== APPROVE ERROR DETAILS ===");
      console.error("Full error:", err);
      console.error("Response data:", err.response?.data);
      console.error("Response status:", err.response?.status);
      
      const errorMsg = err.response?.data?.message || err.response?.data?.error || "Không thể duyệt sách";
      showToast(errorMsg, "error");
    }
  };

  const handleRejectClick = (bookId, title) => {
    setRejectModal({ show: true, bookId, title });
    setRejectReason("");
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      showToast("Vui lòng nhập lý do từ chối", "error");
      return;
    }

    try {
      await api.rejectBook(rejectModal.bookId, rejectReason);
      showToast(`Đã từ chối sách "${rejectModal.title}" với lý do: "${rejectReason}"`, "success");
      // Remove from list
      setBooks(books.filter(b => b.bookId !== rejectModal.bookId));
      setRejectModal({ show: false, bookId: null, title: "" });
      setRejectReason("");
    } catch (err) {
      console.error("=== REJECT ERROR DETAILS ===");
      console.error("Full error:", err);
      console.error("Response data:", err.response?.data);
      console.error("Response status:", err.response?.status);
      console.error("Response headers:", err.response?.headers);
      
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data || "Không thể từ chối sách";
      showToast(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg), "error");
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
  };

  const closeToast = () => {
    setToast({ show: false, message: "", type: "success" });
  };

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="min-h-screen bg-white dark:bg-black">
        <Head>
          <title>Admin - Sách chờ duyệt</title>
        </Head>
        <Header />

        <main className="px-4 py-12 mx-auto max-w-7xl">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Quản lý sách chờ duyệt từ người dùng
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 mb-6 text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900 dark:text-red-200 dark:border-red-700">
              <p className="font-medium">Lỗi</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-16 text-center">
              <div className="inline-block w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Đang tải...</p>
            </div>
          )}

          {/* Stats Cards */}
          {!loading && (
            <div className="grid gap-6 mb-8 md:grid-cols-3">
              <StatCard
                title="Chờ duyệt"
                value={books.length}
                color="yellow"
              />
              <StatCard
                title="Tổng sách (đã duyệt)"
                value={totalBooks}
                color="green"
              />
              <StatCard
                title="Cần xử lý"
                value={books.length > 0 ? "Có việc" : "Trống"}
                color={books.length > 0 ? "red" : "green"}
              />
            </div>
          )}

          {/* Pending Books List */}
          {!loading && (
            <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700">
              <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
                Sách chờ duyệt ({books.length})
              </h2>

              {books.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-xl text-gray-500 dark:text-gray-400">
                  Không có sách nào chờ duyệt
                </p>
              </div>
            ) : books.length > 0 ? (
              <div className="space-y-4">
                {books.map((book) => (
                  <PendingBookCard
                    key={book.bookId}
                    book={book}
                    onApprove={handleApprove}
                    onReject={handleRejectClick}
                  />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-xl text-gray-500 dark:text-gray-400">
                  Không có sách nào đang chờ duyệt
                </p>
              </div>
            )}
            </div>
          )}

          {/* Info Box */}
          <div className="p-6 mt-8 bg-blue-50 border border-blue-200 rounded-xl dark:bg-gray-800 dark:border-blue-900">
            <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-300">
              Lưu ý cho Admin:
            </h3>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200 list-disc list-inside">
              <li>Kiểm tra kỹ nội dung trước khi duyệt</li>
              <li>Đảm bảo không vi phạm bản quyền</li>
              <li>Từ chối với lý do rõ ràng để người dùng hiểu</li>
              <li>Sách đã duyệt sẽ xuất hiện ngay trên trang chủ</li>
            </ul>
          </div>
        </main>

        <Footer />

        {/* Toast Notifications */}
        <Toast
          message={toast.message}
          type={toast.type}
          show={toast.show}
          onClose={closeToast}
        />

        {/* Reject Modal */}
        {rejectModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="w-full max-w-md p-6 bg-white rounded-lg dark:bg-gray-800">
              <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                Từ chối sách: {rejectModal.title}
              </h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do từ chối (bắt buộc)..."
                rows={4}
                className="w-full px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setRejectModal({ show: false, bookId: null, title: "" })}
                  className="flex-1 px-4 py-2 text-gray-700 transition-colors bg-gray-200 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Hủy
                </button>
                <button
                  onClick={handleRejectConfirm}
                  className="flex-1 px-4 py-2 text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700"
                >
                  Xác nhận từ chối
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

function StatCard({ title, value, color }) {
  const colorClasses = {
    yellow: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
    green: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
    red: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
  };

  return (
    <div className={`p-6 border rounded-xl ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function PendingBookCard({ book, onApprove, onReject }) {
  const router = useRouter();

  const formatDate = (dateString) => {
    if (!dateString) return "Không rõ";
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return "Không rõ";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };

  const handlePreview = () => {
    // Navigate with book metadata for immediate display
    router.push({
      pathname: `/read/${book.bookId}`,
      query: {
        title: book.title,
        author: book.author,
        description: book.description,
        pages: book.pages
      }
    });
  };

  const getUploaderDisplay = () =>
    book.uploaderEmail ||
    book.uploader ||
    book.userEmail ||
    book.uploadedBy ||
    book.ownerEmail ||
    book.owner ||
    book.userId ||
    book.userSub ||
    book.email ||
    "Không rõ";

  return (
    <div className="p-6 transition-shadow bg-white border border-gray-200 rounded-xl dark:bg-gray-700 dark:border-gray-600 hover:shadow-lg">
      <div className="flex flex-col gap-4">
        {/* Book Info */}
        <div className="flex-1">
          <h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
            {book.title || "Không có tiêu đề"}
          </h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">Tác giả:</span> {book.author || "Không rõ"}
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">Người tải:</span> {getUploaderDisplay()}
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">Kích thước:</span>{" "}
              {formatFileSize(book.fileSize)}
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">Tải lên:</span> {formatDate(book.uploadedAt || book.createdAt)}
            </p>
          </div>
          {book.description && (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              <span className="font-medium">Mô tả:</span> {book.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 px-6 py-3 font-medium text-blue-600 transition-colors bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/40"
          >
            Xem trước
          </button>
          <button
            onClick={() => onApprove(book.bookId, book.title)}
            className="flex items-center gap-2 px-6 py-3 font-medium text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"
          >
            Duyệt
          </button>
          <button
            onClick={() => onReject(book.bookId, book.title)}
            className="flex items-center gap-2 px-6 py-3 font-medium text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700"
          >
            Từ chối
          </button>
        </div>
      </div>
    </div>
  );
}
