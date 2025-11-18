import Head from "next/head";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function MyUploadsPage() {
  // TODO: Replace with actual API call
  const uploads = [
    {
      bookId: "1",
      title: "My First Book",
      author: "John Doe",
      status: "APPROVED",
      uploadedAt: "2025-01-15T10:30:00Z",
      approvedAt: "2025-01-15T11:00:00Z",
    },
    {
      bookId: "2",
      title: "Pending Book",
      author: "John Doe",
      status: "PENDING",
      uploadedAt: "2025-01-14T10:30:00Z",
    },
    {
      bookId: "3",
      title: "Processing Book",
      author: "John Doe",
      status: "UPLOADING",
      uploadedAt: "2025-01-16T10:29:00Z",
    },
    {
      bookId: "4",
      title: "Rejected Book",
      author: "John Doe",
      status: "REJECTED",
      uploadedAt: "2025-01-13T10:30:00Z",
      rejectedAt: "2025-01-13T11:00:00Z",
      rejectedReason: "Nội dung vi phạm bản quyền",
    },
    {
      bookId: "5",
      title: "Invalid File Type",
      author: "John Doe",
      status: "REJECTED_INVALID_TYPE",
      uploadedAt: "2025-01-12T10:30:00Z",
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Head>
        <title>Sách của tôi - Thư Viện Online</title>
      </Head>
      <Header />

      <main className="px-4 py-12 mx-auto max-w-7xl">
        <h1 className="mb-8 text-4xl font-bold text-center text-gray-900 dark:text-white">
          Sách của tôi
        </h1>

        {uploads.length === 0 ? (
          <div className="py-16 text-center">
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
              <UploadCard key={book.bookId} book={book} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function UploadCard({ book }) {
  const getStatusBadge = (status) => {
    const badges = {
      UPLOADING: {
        text: "Đang xử lý",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
      },
      PENDING: {
        text: "Chờ duyệt",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      },
      APPROVED: {
        text: "Đã duyệt",
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      },
      REJECTED: {
        text: "Bị từ chối",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      },
      REJECTED_INVALID_TYPE: {
        text: "File không hợp lệ",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      },
    };

    const badge = badges[status] || badges.PENDING;
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${badge.className}`}>
        {badge.text}
      </span>
    );
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
          {book.status === "REJECTED" && book.rejectedReason && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Lý do từ chối: {book.rejectedReason}
            </p>
          )}
          {book.status === "REJECTED_INVALID_TYPE" && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              File không đúng định dạng PDF/ePub hoặc bị hỏng
            </p>
          )}
          {book.status === "UPLOADING" && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Đang xử lý file... Vui lòng đợi trong giây lát
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {book.status === "APPROVED" && (
            <Link
              href={`/books/${book.bookId}`}
              className="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Đọc sách
            </Link>
          )}
          {book.status === "PENDING" && (
            <span className="px-4 py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-lg dark:bg-gray-700 dark:text-gray-400">
              Đang chờ duyệt
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
