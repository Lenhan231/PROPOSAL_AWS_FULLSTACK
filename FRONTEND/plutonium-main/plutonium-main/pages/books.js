import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function BooksPage() {
  const [searchMode, setSearchMode] = useState("title"); // "title" or "author"
  const [searchQuery, setSearchQuery] = useState("");

  // TODO: Replace with actual API call
  const books = [
    {
      bookId: "1",
      title: "AWS Serverless Architecture",
      author: "John Doe",
      description: "A comprehensive guide to building serverless applications on AWS",
    },
    {
      bookId: "2",
      title: "Next.js Complete Guide",
      author: "Jane Smith",
      description: "Master Next.js from basics to advanced concepts",
    },
    {
      bookId: "3",
      title: "React Best Practices",
      author: "Bob Johnson",
      description: "Learn the best practices for building React applications",
    },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    // TODO: Implement search API call
    console.log(`Searching ${searchMode}:`, searchQuery);
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
            <div className="flex flex-col gap-4 mb-4 sm:flex-row">
              {/* Search Mode Selector */}
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value)}
                className="px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="title">Tìm theo tên sách</option>
                <option value="author">Tìm theo tác giả</option>
              </select>

              {/* Search Input */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  searchMode === "title"
                    ? "Nhập tên sách..."
                    : "Nhập tên tác giả..."
                }
                className="flex-1 px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Search Button */}
              <button
                type="submit"
                className="px-6 py-2 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Tìm kiếm
              </button>
            </div>
            <p className="text-sm text-center text-gray-500 dark:text-gray-400">
              Lưu ý: Chỉ tìm kiếm theo một tiêu chí tại một thời điểm
            </p>
          </form>
        </div>

        {/* Books Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard key={book.bookId} book={book} />
          ))}
        </div>

        {/* Empty State */}
        {books.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-xl text-gray-500 dark:text-gray-400">
              Không tìm thấy sách nào
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function BookCard({ book }) {
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
      <Link
        href={`/books/${book.bookId}`}
        className="inline-block px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        Đọc sách
      </Link>
    </div>
  );
}
