import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api } from "../lib/api";
import Toast from "../components/Toast";

export default function BooksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState({ total: 0, limit: 20 });
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Load all books on initial mount
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async (params = {}) => {
    try {
      setLoading(true);
      setError("");
      const result = await api.searchBooks(params);
      
      // Backend returns { books: [...] } instead of { data: [...] }
      setBooks(result.books || []);
      setMeta({ total: result.books?.length || 0, limit: params.limit || 20 });
    } catch (err) {
      console.error("Failed to load books:", err);
      
      // Check if it's a network/CORS error (backend not implemented)
      if (err.code === "ERR_NETWORK" || err.response?.status === 404) {
        // Show mock data for development
        const mockBooks = [
          {
            bookId: "mock-1",
            title: "AWS Serverless Architecture",
            author: "John Doe",
            description: "A comprehensive guide to building serverless applications on AWS. Learn about Lambda, API Gateway, and more.",
            status: "APPROVED"
          },
          {
            bookId: "mock-2",
            title: "Next.js Complete Guide",
            author: "Jane Smith",
            description: "Master Next.js from basics to advanced concepts. Includes React Server Components and App Router.",
            status: "APPROVED"
          },
          {
            bookId: "mock-3",
            title: "React Best Practices",
            author: "Bob Johnson",
            description: "Learn the best practices for building React applications with hooks, context, and performance optimization.",
            status: "APPROVED"
          },
        ];
        setBooks(mockBooks);
        setMeta({ total: mockBooks.length, limit: 20 });
        setError("⚠️ Đang sử dụng dữ liệu mẫu. Backend API chưa được triển khai.");
      } else {
        setError(err.response?.data?.message || "Không thể tải danh sách sách");
        setBooks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      // If empty, load all books (no query param)
      loadBooks({ limit: 20 });
      return;
    }

    // Backend uses 'q' for search query
    const params = {
      q: searchQuery.trim(),
      limit: 20,
    };

    await loadBooks(params);
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
  };

  const closeToast = () => {
    setToast({ show: false, message: "", type: "success" });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Head>
        <title>Khám phá sách - Thư Viện Online</title>
      </Head>
      <Header />

      <main className="px-4 py-12 mx-auto max-w-7xl">
        {/* Search Section */}
        <div className="mb-12">
          <h1 className="mb-8 text-4xl font-bold text-center text-gray-900 dark:text-white">
            Khám phá sách
          </h1>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="flex gap-4 mb-4">
              {/* Search Input */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm sách (tên sách, tác giả, từ khóa...)"
                className="flex-1 px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />

              {/* Search Button */}
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Đang tìm..." : "Tìm kiếm"}
              </button>
            </div>
            <p className="text-sm text-center text-gray-500 dark:text-gray-400">
              {searchQuery ? "Để xem tất cả sách, xóa từ khóa và tìm kiếm" : "Lưu ý: Chỉ tìm kiếm theo một tiêu chí tại một thời điểm"}
            </p>
          </form>
        </div>

        {/* Error/Warning Message */}
        {error && (
          <div className={`max-w-2xl p-4 mx-auto mb-6 rounded-lg ${
            error.startsWith("⚠️") 
              ? "text-yellow-800 bg-yellow-100 border border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700"
              : "text-red-800 bg-red-100 border border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700"
          }`}>
            <p className="font-medium">{error.startsWith("⚠️") ? "Thông báo" : "Lỗi"}</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center">
            <div className="inline-block w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Đang tải sách...</p>
          </div>
        )}

        {/* Books Grid */}
        {!loading && books.length > 0 && (
          <>
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Tìm thấy <span className="font-medium">{meta.total}</span> sách
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {books.map((book) => (
                <BookCard key={book.bookId} book={book} onError={showToast} />
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && books.length === 0 && !error && (
          <div className="py-16 text-center">
            <p className="text-xl text-gray-500 dark:text-gray-400">
              {searchQuery ? "Không tìm thấy sách phù hợp" : "Chưa có sách nào trong thư viện"}
            </p>
          </div>
        )}
      </main>

      <Footer />
      
      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={closeToast}
      />
    </div>
  );
}

function BookCard({ book, onError }) {
  const [loading, setLoading] = useState(false);

  const handleRead = async () => {
    // Check if this is mock data
    if (book.bookId.startsWith("mock-")) {
      onError("⚠️ Backend API chưa được triển khai. Chức năng đọc sách sẽ khả dụng sau khi triển khai Lambda getReadUrl.", "error");
      return;
    }

    try {
      setLoading(true);
      const result = await api.getReadUrl(book.bookId);
      
      // Handle both 'url' and 'readUrl' response formats
      const signedUrl = result.url || result.readUrl;
      
      if (signedUrl) {
        // Open the signed URL in a new tab
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } else {
        onError("Không thể lấy URL đọc sách", "error");
      }
    } catch (err) {
      console.error("Failed to get read URL:", err);
      const errorMsg = err.response?.data?.message || err.message;
      
      if (err.code === "ERR_NETWORK" || err.response?.status === 404) {
        onError("Backend API chưa được triển khai. Vui lòng triển khai Lambda getReadUrl trước.", "error");
      } else if (err.response?.status === 403) {
        onError("Sách chưa được duyệt hoặc bạn không có quyền truy cập", "error");
      } else {
        onError(errorMsg || "Không thể đọc sách. Vui lòng thử lại sau", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 transition-shadow bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg">
      <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
        {book.title}
      </h3>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Tác giả: {book.author}
      </p>
      <p className="mb-4 text-gray-700 dark:text-gray-300 line-clamp-3">
        {book.description}
      </p>
      <button
        onClick={handleRead}
        disabled={loading}
        className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Đang tải...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Đọc sách
          </>
        )}
      </button>
    </div>
  );
}
