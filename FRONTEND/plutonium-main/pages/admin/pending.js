import { useState, useEffect } from "react";
import Head from "next/head";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import ProtectedRoute from "../../components/ProtectedRoute";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";
import { BOOK_STATUS } from "../../lib/constants";

// Force SSR to ensure auth context is available
export async function getServerSideProps() {
  return { props: {} };
}

export default function AdminPendingPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [rejectModal, setRejectModal] = useState({ show: false, bookId: null, title: "" });
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadPendingBooks();
  }, []);

  const loadPendingBooks = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await api.getPendingBooks();
      setBooks(result.books || []);
    } catch (err) {
      console.error("Failed to load pending books:", err);
      setError(err.response?.data?.message || "Không thể tải danh sách sách chờ duyệt");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (bookId, title) => {
    if (!confirm(`Duyệt sách "${title}"?`)) return;

    try {
      await api.approveBook(bookId);
      showToast(`Đã duyệt sách "${title}"`, "success");
      // Remove from list or reload
      setBooks(books.filter(b => b.bookId !== bookId));
    } catch (err) {
      console.error("Failed to approve book:", err);
      showToast(err.response?.data?.message || "Không thể duyệt sách", "error");
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
      showToast(`Đã từ chối sách "${rejectModal.title}"`, "success");
      // Remove from list or reload
      setBooks(books.filter(b => b.bookId !== rejectModal.bookId));
      setRejectModal({ show: false, bookId: null, title: "" });
      setRejectReason("");
    } catch (err) {
      console.error("Failed to reject book:", err);
      showToast(err.response?.data?.message || "Không thể từ chối sách", "error");
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
                icon="⏳"
                color="yellow"
              />
              <StatCard
                title="Tổng sách"
                value={books.length}
                icon="📚"
                color="green"
              />
              <StatCard
                title="Trạng thái"
                value="Active"
                icon="✅"
                color="green"
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
              💡 Lưu ý cho Admin:
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

function StatCard({ title, value, icon, color }) {
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
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}

function PendingBookCard({ book, onApprove, onReject }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };

  return (
    <div className="p-6 transition-shadow bg-white border border-gray-200 rounded-xl dark:bg-gray-700 dark:border-gray-600 hover:shadow-lg">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            {book.title}
          </h3>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <p>
              <span className="font-medium">Tác giả:</span> {book.author}
            </p>
            <p>
              <span className="font-medium">Người tải:</span> {book.uploaderEmail || book.uploader}
            </p>
            <p>
              <span className="font-medium">Kích thước:</span>{" "}
              {formatFileSize(book.fileSize)}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onApprove(book.bookId, book.title)}
            className="px-6 py-3 font-medium text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"
          >
            ✅ Duyệt
          </button>
          <button
            onClick={() => onReject(book.bookId, book.title)}
            className="px-6 py-3 font-medium text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700"
          >
            ❌ Từ chối
          </button>
        </div>
      </div>
    </div>
  );
}
