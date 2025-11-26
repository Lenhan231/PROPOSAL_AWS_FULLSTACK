import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../src/contexts/AuthContext';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { confirmForgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Get email from URL query params
  useEffect(() => {
    if (router.query.email) {
      setEmail(decodeURIComponent(router.query.email));
    }
  }, [router.query.email]);

  const validatePassword = (password) => {
    if (password.length < 8) {
      return 'Mật khẩu phải có ít nhất 8 ký tự';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Mật khẩu phải có ít nhất 1 chữ hoa';
    }
    if (!/[a-z]/.test(password)) {
      return 'Mật khẩu phải có ít nhất 1 chữ thường';
    }
    if (!/[0-9]/.test(password)) {
      return 'Mật khẩu phải có ít nhất 1 số';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp!');
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      await confirmForgotPassword(email, code, newPassword);
      setMessage('Đặt lại mật khẩu thành công! Đang chuyển đến trang đăng nhập...');
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      if (err.message.includes('CodeMismatchException')) {
        setError('Mã xác nhận không đúng. Vui lòng kiểm tra lại.');
      } else if (err.message.includes('ExpiredCodeException')) {
        setError('Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới.');
      } else if (err.message.includes('InvalidPasswordException')) {
        setError('Mật khẩu không đủ mạnh. Vui lòng chọn mật khẩu khác.');
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
        <title>Đặt lại mật khẩu - Thư Viện Online</title>
      </Head>
      <Header />

      <main className="flex items-center justify-center px-4 py-12 mx-auto max-w-md">
        <div className="w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Đặt lại mật khẩu
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Nhập mã xác nhận và mật khẩu mới
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

              {/* Verification Code */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                  Mã xác nhận *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg tracking-wider"
                  placeholder="123456"
                  required
                  disabled={loading || !!message}
                  maxLength={6}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Nhập mã 6 số đã được gửi đến email
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                  Mật khẩu mới *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                    disabled={loading || !!message}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường và số
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                  disabled={loading || !!message}
                  minLength={8}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !!message}
                className="w-full px-6 py-3 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Đang xử lý...' : message ? 'Đang chuyển hướng...' : 'Đặt lại mật khẩu'}
              </button>
            </form>

            {/* Back Links */}
            <div className="mt-6 flex justify-between text-sm">
              <Link
                href="/forgot-password"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ← Gửi lại mã
              </Link>
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Đăng nhập
              </Link>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-gray-800 dark:border-blue-900">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Không nhận được mã?</strong> Kiểm tra thư mục spam hoặc yêu cầu gửi lại mã mới.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
