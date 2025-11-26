import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../src/contexts/AuthContext';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await forgotPassword(email);
      setMessage('Mã xác nhận đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.');
      // Redirect to reset page after 2 seconds
      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch (err) {
      console.error('Forgot password error:', err);
      if (err.message.includes('UserNotFoundException')) {
        setError('Email không tồn tại trong hệ thống.');
      } else if (err.message.includes('LimitExceededException')) {
        setError('Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.');
      } else {
        setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Head>
        <title>Quên mật khẩu - Thư Viện Online</title>
      </Head>
      <Header />

      <main className="flex items-center justify-center px-4 py-12 mx-auto max-w-md">
        <div className="w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Quên mật khẩu?
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Nhập email của bạn để nhận mã xác nhận
            </p>
          </div>

          <div className="p-8 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Success Message */}
              {message && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    ✓ {message}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    ✕ {error}
                  </p>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@example.com"
                  required
                  disabled={loading || !!message}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !!message}
                className="w-full px-6 py-3 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Đang gửi...' : message ? 'Đang chuyển hướng...' : 'Gửi mã xác nhận'}
              </button>
            </form>

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ← Quay lại đăng nhập
              </Link>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-gray-800 dark:border-blue-900">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Lưu ý:</strong> Mã xác nhận sẽ được gửi đến email của bạn và có hiệu lực trong 15 phút.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
