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
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl -z-10"></div>
        
        <div className="px-4 pt-20 pb-24 mx-auto max-w-7xl md:pt-32 md:pb-40">
          <div className="w-full mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium text-blue-700 bg-blue-100 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
              <span className="mr-2">🎉</span>
              Nền tảng chia sẻ tài liệu miễn phí
            </div>

            {/* Main Heading */}
            <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-7xl">
              Thư Viện Online
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
                Tri thức cho mọi người
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-3xl mx-auto mb-10 text-xl leading-relaxed text-gray-600 dark:text-gray-300 md:text-2xl">
              Khám phá hàng nghìn tài liệu PDF/ePub chất lượng cao. 
              Chia sẻ kiến thức, xây dựng cộng đồng học tập.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link 
                href="/books" 
                className="group relative inline-flex items-center px-8 py-4 text-base font-semibold text-white transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:shadow-xl hover:shadow-blue-500/50 hover:scale-105"
              >
                <span className="mr-2">📚</span>
                Khám phá ngay
                <svg className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link 
                href="/upload" 
                className="inline-flex items-center px-8 py-4 text-base font-semibold text-gray-900 transition-all duration-300 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-600 hover:shadow-lg dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:border-blue-500"
              >
                <span className="mr-2">⬆️</span>
                Tải lên tài liệu
              </Link>
            </div>

            {/* Stats */}
            <div className="grid max-w-3xl grid-cols-1 gap-8 mx-auto mt-16">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">100%</div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">Miễn phí</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20 bg-white dark:bg-black md:py-32">
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white md:text-5xl">
              Tính năng nổi bật
            </h2>
            <p className="max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-400">
              Trải nghiệm đọc sách hiện đại với đầy đủ tính năng cần thiết
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              title="Đọc trực tuyến"
              description="Đọc PDF/ePub ngay trên trình duyệt với trải nghiệm mượt mà"
              icon="📖"
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              title="Tải lên dễ dàng"
              description="Upload tài liệu nhanh chóng chỉ với vài thao tác đơn giản"
              icon="⬆️"
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              title="Tìm kiếm thông minh"
              description="Tìm sách theo tên hoặc tác giả với kết quả chính xác"
              icon="🔍"
              gradient="from-orange-500 to-red-500"
            />
            <FeatureCard
              title="An toàn & Bảo mật"
              description="Hệ thống kiểm duyệt nghiêm ngặt, bảo vệ bản quyền"
              icon="🛡️"
              gradient="from-green-500 to-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-20 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white md:text-5xl">
              Cách thức hoạt động
            </h2>
            <p className="max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-400">
              Chỉ với 3 bước đơn giản để bắt đầu
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              step="1"
              title="Đăng ký tài khoản"
              description="Tạo tài khoản miễn phí chỉ trong vài giây"
              icon="👤"
            />
            <StepCard
              step="2"
              title="Khám phá hoặc tải lên"
              description="Tìm kiếm sách yêu thích hoặc chia sẻ tài liệu của bạn"
              icon="📚"
            />
            <StepCard
              step="3"
              title="Đọc và học tập"
              description="Truy cập tài liệu mọi lúc, mọi nơi trên mọi thiết bị"
              icon="✨"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 bg-white dark:bg-black md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="relative p-12 overflow-hidden text-center text-white rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 md:p-20">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <h2 className="mb-6 text-4xl font-bold md:text-5xl">
                Sẵn sàng bắt đầu hành trình học tập?
              </h2>
              <p className="max-w-2xl mx-auto mb-10 text-xl text-blue-100">
                Tham gia cộng đồng hàng nghìn người dùng đang chia sẻ và học hỏi mỗi ngày
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link 
                  href="/signup" 
                  className="inline-flex items-center px-8 py-4 text-lg font-semibold text-blue-600 transition-all duration-300 bg-white rounded-xl hover:shadow-2xl hover:scale-105"
                >
                  Đăng ký miễn phí
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link 
                  href="/books" 
                  className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white transition-all duration-300 border-2 border-white rounded-xl hover:bg-white/10"
                >
                  Xem thư viện
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FeatureCard({ icon, title, description, gradient }) {
  return (
    <div className="relative p-8 transition-all duration-300 bg-white border border-gray-200 group rounded-2xl dark:bg-gray-800 dark:border-gray-700 hover:shadow-2xl hover:-translate-y-2">
      {/* Gradient background on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`}></div>
      
      <div className="relative">
        <div className={`inline-flex items-center justify-center w-16 h-16 mb-6 text-3xl bg-gradient-to-br ${gradient} rounded-2xl`}>
          <span className="filter drop-shadow-lg">{icon}</span>
        </div>
        <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="leading-relaxed text-gray-600 dark:text-gray-300">
          {description}
        </p>
      </div>
    </div>
  );
}

function StepCard({ step, icon, title, description }) {
  return (
    <div className="relative p-8 text-center transition-all duration-300 bg-white border border-gray-200 group rounded-2xl dark:bg-gray-800 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1">
      {/* Step number */}
      <div className="absolute top-0 right-0 flex items-center justify-center w-12 h-12 -mt-6 -mr-6 text-xl font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full shadow-lg">
        {step}
      </div>
      
      <div className="mb-6 text-5xl">{icon}</div>
      <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-300">
        {description}
      </p>
    </div>
  );
}
