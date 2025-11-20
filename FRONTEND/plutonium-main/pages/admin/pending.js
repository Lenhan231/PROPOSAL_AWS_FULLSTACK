import Head from "next/head";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import ProtectedRoute from "../../components/ProtectedRoute";

// Disable static generation for this page (requires authentication)
export const config = {
  unstable_runtimeJS: true,
};

export default function AdminPendingPage() {
  // TODO: Replace with real API call using usePendingBooks hook
  const pendingBooks = [
    {
      bookId: "1",
      title: "AWS Serverless Architecture",
      author: "John Doe",
      uploader: "user@example.com",
      uploadedAt: "2025-01-20T10:30:00Z",
      fileSize: 5242880,
    },
    {
      bookId: "2",
      title: "Next.js Complete Guide",
      author: "Jane Smith",
      uploader: "student@example.com",
      uploadedAt: "2025-01-20T09:15:00Z",
      fileSize: 3145728,
    },
  ];

  const handleApprove = (bookId) => {
    // TODO: Implement with useApproveBook hook
    if (confirm("Duyệt sách này?")) {
      alert(`Đã duyệt sách ${bookId}`);
    }
  };

  const handleReject = (bookId) => {
    // TODO: Implement with useRejectBook hook and modal
    const reason = prompt("Nhập lý do từ chối:");
    if (reason) {
      alert(`Đã từ chối sách ${bookId}: ${reason}`);
    }
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

          {/* Stats Cards */}
          <div className="grid gap-6 mb-8 md:grid-cols-3">
            <StatCard
              title="Chờ duyệt"
              value={pendingBooks.length}
              icon="⏳"
              color="yellow"
            />
            <StatCard
              title="Đã duyệt hôm nay"
              value="0"
              icon="✅"
              color="green"
            />
            <StatCard
              title="Đã từ chối hôm nay"
              value="0"
              icon="❌"
              color="red"
            />
          </div>

          {/* Pending Books List */}
          <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700">
            <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
              Sách chờ duyệt ({pendingBooks.length})
            </h2>

            {pendingBooks.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-xl text-gray-500 dark:text-gray-400">
                  Không có sách nào chờ duyệt
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingBooks.map((book) => (
                  <PendingBookCard
                    key={book.bookId}
                    book={book}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            )}
          </div>

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
              <span className="font-medium">Người tải:</span> {book.uploader}
            </p>
            <p>
              <span className="font-medium">Thời gian:</span>{" "}
              {formatDate(book.uploadedAt)}
            </p>
            <p>
              <span className="font-medium">Kích thước:</span>{" "}
              {formatFileSize(book.fileSize)}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onApprove(book.bookId)}
            className="px-6 py-3 font-medium text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"
          >
            ✅ Duyệt
          </button>
          <button
            onClick={() => onReject(book.bookId)}
            className="px-6 py-3 font-medium text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700"
          >
            ❌ Từ chối
          </button>
        </div>
      </div>
    </div>
  );
}
// Force server-side rendering to avoid static export errors with AuthContext
export async function getServerSideProps() {
  return {
    props: {},
  };
}
