import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="bg-white dark:bg-black">
      <NextSeo
        title="Thư Viện Online"
        description="Nền tảng chia sẻ tài liệu PDF/ePub an toàn cho cộng đồng"
        canonical="https://library.vercel.app/"
        openGraph={{
          url: "https://library.vercel.app/",
          title: "Thư Viện Online",
          description: "Nền tảng chia sẻ tài liệu PDF/ePub an toàn cho cộng đồng",
          site_name: "Thư Viện Online",
        }}
      />
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-black">
        <div className="px-4 pt-16 pb-20 mx-auto max-w-7xl md:pt-24 md:pb-32">
          <div className="w-full mx-auto text-center md:w-11/12">
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-6xl">
              Thư Viện Online
            </h1>
            <p className="max-w-2xl mx-auto mb-8 text-xl text-gray-600 dark:text-gray-400 md:text-2xl">
              Nền tảng chia sẻ tài liệu PDF/ePub an toàn cho cộng đồng
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/books" className="inline-flex items-center px-8 py-3 text-base font-medium text-white transition duration-300 bg-blue-600 rounded-lg hover:bg-blue-700">
                Khám phá sách
              </Link>
              <Link href="/upload" className="inline-flex items-center px-8 py-3 text-base font-medium text-blue-600 transition duration-300 border-2 border-blue-600 rounded-lg hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-gray-800">
                Tải lên tài liệu
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16 bg-white dark:bg-black md:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-3xl font-bold text-center text-gray-900 dark:text-white md:text-4xl">
            Tính năng nổi bật
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              title="Đọc trực tuyến"
              description="Đọc PDF/ePub ngay trên trình duyệt, không cần tải về"
              icon="📖"
            />
            <FeatureCard
              title="Tải lên dễ dàng"
              description="Upload tài liệu nhanh chóng với giao diện thân thiện"
              icon="⬆️"
            />
            <FeatureCard
              title="Tìm kiếm thông minh"
              description="Tìm sách theo tên hoặc tác giả một cách nhanh chóng"
              icon="🔍"
            />
            <FeatureCard
              title="An toàn & Bảo mật"
              description="Hệ thống kiểm duyệt nội dung và bảo vệ bản quyền"
              icon="🛡️"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16 bg-white dark:bg-black md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="p-8 text-center text-white bg-blue-600 rounded-2xl md:p-12">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Sẵn sàng bắt đầu?
            </h2>
            <p className="mb-8 text-xl text-blue-100">
              Đăng ký ngay để truy cập hàng trăm tài liệu chất lượng
            </p>
            <Link href="/signup" className="inline-block px-8 py-3 font-medium text-blue-600 transition-colors bg-white rounded-lg hover:bg-gray-100">
              Đăng ký miễn phí
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="p-6 transition-shadow bg-white rounded-xl dark:bg-gray-800 shadow-sm hover:shadow-md">
      <div className="mb-4 text-4xl">{icon}</div>
      <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  );
}
