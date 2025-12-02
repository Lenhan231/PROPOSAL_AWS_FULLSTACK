import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
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
  const [viewMode, setViewMode] = useState("list"); // "list" or "grid"

  // Load all books on initial mount
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async (params = {}) => {
    try {
      setLoading(true);
      setError("");
      const result = await api.searchBooks(params);
      
      setBooks(result.books || []);
      setMeta({ total: result.books?.length || 0, limit: params.limit || 20 });
    } catch (err) {
      console.error("Failed to load books:", err);
      
      if (err.code === "ERR_NETWORK" || err.response?.status === 404) {
        const mockBooks = [
          {
            bookId: "mock-1",
            title: "AWS Serverless Architecture",
            author: "John Doe",
            description: "A comprehensive guide to building serverless applications on AWS. Learn about Lambda, API Gateway, DynamoDB and more.",
            status: "APPROVED",
            coverColor: "from-blue-500 to-indigo-600"
          },
          {
            bookId: "mock-2",
            title: "Next.js Complete Guide",
            author: "Jane Smith",
            description: "Master Next.js from basics to advanced concepts. Includes React Server Components and App Router.",
            status: "APPROVED",
            coverColor: "from-purple-500 to-pink-600"
          },
          {
            bookId: "mock-3",
            title: "React Best Practices",
            author: "Bob Johnson",
            description: "Learn the best practices for building React applications with hooks, context, and performance optimization.",
            status: "APPROVED",
            coverColor: "from-cyan-500 to-blue-600"
          },
          {
            bookId: "mock-4",
            title: "Python for Data Science",
            author: "Alice Brown",
            description: "Complete guide to Python programming for data analysis, machine learning, and visualization.",
            status: "APPROVED",
            coverColor: "from-green-500 to-emerald-600"
          },
          {
            bookId: "mock-5",
            title: "Docker & Kubernetes",
            author: "Charlie Wilson",
            description: "Learn containerization and orchestration with Docker and Kubernetes from scratch.",
            status: "APPROVED",
            coverColor: "from-orange-500 to-red-600"
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
      loadBooks({ limit: 20 });
      return;
    }

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Head>
        <title>Khám phá sách - Thư Viện Online</title>
      </Head>
      <Header />

      <main className="px-4 py-8 mx-auto max-w-6xl">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            📚 Thư viện sách
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Khám phá và đọc hàng nghìn tài liệu chất lượng
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 mb-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700">
          <form onSubmit={handleSearch} className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên sách, tác giả..."
                className="w-full py-2.5 pl-10 pr-4 text-sm text-gray-900 bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Search Button */}
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-medium text-white transition-all bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                  Đang tìm...
                </>
              ) : (
                "Tìm kiếm"
              )}
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg dark:bg-gray-700">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
                title="Xem dạng danh sách"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
                title="Xem dạng lưới"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        {/* Warning/Error Message */}
        {error && (
          <div className={`p-4 mb-6 rounded-lg ${
            error.startsWith("⚠️") 
              ? "text-amber-800 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800"
              : "text-red-800 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
          }`}>
            <div className="flex items-center gap-2">
              <span>{error.startsWith("⚠️") ? "ℹ️" : "❌"}</span>
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Results Count */}
        {!loading && books.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Hiển thị <span className="font-semibold text-gray-900 dark:text-white">{books.length}</span> sách
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center">
            <div className="inline-block w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Đang tải sách...</p>
          </div>
        )}

        {/* Books List View */}
        {!loading && books.length > 0 && viewMode === "list" && (
          <div className="space-y-4">
            {books.map((book, index) => (
              <BookListItem key={book.bookId} book={book} index={index} onError={showToast} />
            ))}
          </div>
        )}

        {/* Books Grid View */}
        {!loading && books.length > 0 && viewMode === "grid" && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book, index) => (
              <BookGridCard key={book.bookId} book={book} index={index} onError={showToast} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && books.length === 0 && !error && (
          <div className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-4 text-4xl bg-gray-100 rounded-full dark:bg-gray-800">
              📖
            </div>
            <p className="mb-2 text-xl font-medium text-gray-900 dark:text-white">
              {searchQuery ? "Không tìm thấy sách" : "Thư viện trống"}
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? "Thử tìm kiếm với từ khóa khác" : "Chưa có sách nào trong thư viện"}
            </p>
          </div>
        )}
      </main>

      <Footer />
      
      <Toast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={closeToast}
      />
    </div>
  );
}

// Book List Item Component - Dạng danh sách với thumbnail
function BookListItem({ book, index, onError }) {
  const router = useRouter();

  // Generate gradient colors based on index
  const gradients = [
    "from-blue-500 to-indigo-600",
    "from-purple-500 to-pink-600",
    "from-cyan-500 to-blue-600",
    "from-green-500 to-emerald-600",
    "from-orange-500 to-red-600",
    "from-rose-500 to-pink-600",
    "from-violet-500 to-purple-600",
    "from-teal-500 to-cyan-600",
  ];
  const gradient = book.coverColor || gradients[index % gradients.length];

  const handleRead = () => {
    if (book.bookId.startsWith("mock-")) {
      onError("⚠️ Đây là dữ liệu mẫu. Chức năng đọc sách sẽ khả dụng khi backend được triển khai.", "warning");
      return;
    }
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

  // Get file type icon
  const getFileIcon = () => {
    const fileName = book.fileName || "";
    if (fileName.endsWith(".epub")) {
      return "📱";
    }
    return "📄";
  };

  return (
    <div className="group flex gap-4 p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200">
      {/* Book Cover Thumbnail */}
      <div className="flex-shrink-0">
        <div className={`relative w-20 h-28 sm:w-24 sm:h-32 rounded-lg bg-gradient-to-br ${gradient} shadow-lg overflow-hidden`}>
          {/* Book spine effect */}
          <div className="absolute inset-y-0 left-0 w-1 bg-black/20"></div>
          
          {/* Book title on cover - dynamic font size */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
            <span 
              className="text-white font-bold leading-tight drop-shadow-md w-full"
              style={{
                fontSize: book.title?.length > 50 ? '0.5rem' : book.title?.length > 30 ? '0.6rem' : '0.75rem',
                lineHeight: '1.2'
              }}
            >
              {book.title}
            </span>
          </div>
          
          {/* File type badge */}
          <div className="absolute bottom-1 right-1 text-sm">
            {getFileIcon()}
          </div>
          
          {/* Shine effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
      </div>

      {/* Book Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {book.title || "Không có tiêu đề"}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {book.author || "Không rõ tác giả"}
              </span>
            </p>
          </div>
          
          {/* Status Badge */}
          <span className="flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            ✓ Đã duyệt
          </span>
        </div>

        {/* Description */}
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {book.description || "Chưa có mô tả cho sách này."}
        </p>

        {/* Meta & Actions */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
            {book.uploaderEmail && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {book.uploaderEmail.split("@")[0]}
              </span>
            )}
            {book.fileSize && (
              <span>{(book.fileSize / 1024 / 1024).toFixed(1)} MB</span>
            )}
          </div>

          <button
            onClick={handleRead}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow-md active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Đọc sách
          </button>
        </div>
      </div>
    </div>
  );
}

// Book Grid Card Component - Dạng lưới
function BookGridCard({ book, index, onError }) {
  const router = useRouter();

  const gradients = [
    "from-blue-500 to-indigo-600",
    "from-purple-500 to-pink-600",
    "from-cyan-500 to-blue-600",
    "from-green-500 to-emerald-600",
    "from-orange-500 to-red-600",
    "from-rose-500 to-pink-600",
    "from-violet-500 to-purple-600",
    "from-teal-500 to-cyan-600",
  ];
  const gradient = book.coverColor || gradients[index % gradients.length];

  const handleRead = () => {
    if (book.bookId.startsWith("mock-")) {
      onError("⚠️ Đây là dữ liệu mẫu. Chức năng đọc sách sẽ khả dụng khi backend được triển khai.", "warning");
      return;
    }
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

  const getFileIcon = () => {
    const fileName = book.fileName || "";
    if (fileName.endsWith(".epub")) {
      return "📱";
    }
    return "📄";
  };

  return (
    <div className="group bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 overflow-hidden">
      {/* Book Cover */}
      <div className={`relative h-48 bg-gradient-to-br ${gradient}`}>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <span 
            className="text-white font-bold text-center leading-tight drop-shadow-lg w-full px-2"
            style={{
              fontSize: book.title?.length > 50 ? '0.875rem' : book.title?.length > 30 ? '1rem' : '1.125rem',
              lineHeight: '1.3'
            }}
          >
            {book.title}
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
        
        {/* File type badge */}
        <div className="absolute top-3 left-3 text-2xl drop-shadow-md">
          {getFileIcon()}
        </div>
        
        {/* Status Badge */}
        <span className="absolute top-3 right-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/90 text-green-700 shadow-sm">
          ✓ Đã duyệt
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {book.title || "Không có tiêu đề"}
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {book.author || "Không rõ tác giả"}
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-500 line-clamp-2">
          {book.description || "Chưa có mô tả"}
        </p>

        {/* Meta Info */}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-500">
          {book.uploaderEmail && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {book.uploaderEmail.split("@")[0]}
            </span>
          )}
          {book.fileSize && (
            <span>{(book.fileSize / 1024 / 1024).toFixed(1)} MB</span>
          )}
        </div>

        <button
          onClick={handleRead}
          className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white transition-all bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Đọc sách
        </button>
      </div>
    </div>
  );
}
