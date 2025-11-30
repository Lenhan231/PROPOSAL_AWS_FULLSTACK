import { useState, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Head from 'next/head';
import Link from 'next/link';

export default function Settings() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const { user, changePassword, updateEmail, verifyEmailUpdate, updateName } = useAuth();
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationCode, setShowVerificationCode] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingVerification, setIsLoadingVerification] = useState(false);
  const [isLoadingName, setIsLoadingName] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (user?.attributes?.email) {
      setEmail(user.attributes.email);
    }
    if (user?.attributes?.name) {
      setName(user.attributes.name);
    }
  }, [user]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu mới không khớp');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccessMessage('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMessage(err.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra mật khẩu hiện tại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    if (!email || !email.includes('@')) {
      setEmailError('Vui lòng nhập email hợp lệ');
      return;
    }

    setIsLoadingEmail(true);
    try {
      await updateEmail(email);
      setPendingEmail(email);
      setShowVerificationCode(true);
      setEmailSuccess('Mã xác thực đã được gửi đến email mới. Vui lòng kiểm tra hộp thư của bạn.');
    } catch (err) {
      setEmailError(err.message || 'Không thể cập nhật email. Vui lòng thử lại.');
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    if (!verificationCode || verificationCode.length !== 6) {
      setEmailError('Vui lòng nhập mã xác thực 6 chữ số');
      return;
    }

    setIsLoadingVerification(true);
    try {
      await verifyEmailUpdate(verificationCode);
      setEmailSuccess('Email đã được cập nhật và xác thực thành công!');
      setShowVerificationCode(false);
      setVerificationCode('');
      setPendingEmail('');
    } catch (err) {
      setEmailError(err.message || 'Mã xác thực không đúng. Vui lòng thử lại.');
    } finally {
      setIsLoadingVerification(false);
    }
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');

    if (!name || name.trim().length === 0) {
      setNameError('Tên không được để trống');
      return;
    }

    setIsLoadingName(true);
    try {
      await updateName(name.trim());
      setNameSuccess('Tên đã được cập nhật thành công!');
    } catch (err) {
      setNameError(err.message || 'Không thể cập nhật tên. Vui lòng thử lại.');
    } finally {
      setIsLoadingName(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Cài đặt - Thư Viện Online</title>
      </Head>

      <div className="max-w-3xl mx-auto">
        {/* Back Link */}
        <Link href="/books" className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          ⚙️ Cài đặt tài khoản
        </h1>

        {/* Account Info Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Thông tin tài khoản
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  User ID
                </label>
                <div className="text-gray-900 dark:text-white font-mono text-sm">
                  {user?.username || 'N/A'}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Tên hiển thị hiện tại
                </label>
                <div className="text-gray-900 dark:text-white font-medium">
                  {name || user?.attributes?.name || 'Chưa đặt tên'}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Email hiện tại
                </label>
                <div className="text-gray-900 dark:text-white font-medium">
                  {email || user?.attributes?.email || 'Chưa có email'}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Username Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Cập nhật tên hiển thị
          </h2>

          {nameSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
              <div className="flex items-center">
                <span className="mr-2 text-green-600 dark:text-green-400">✓</span>
                <p className="text-sm text-green-800 dark:text-green-300">{nameSuccess}</p>
              </div>
            </div>
          )}

          {nameError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
              <div className="flex items-center">
                <span className="mr-2 text-red-600 dark:text-red-400">⚠️</span>
                <p className="text-sm text-red-800 dark:text-red-300">{nameError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleNameSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tên của bạn
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập tên của bạn"
                required
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Tên này sẽ hiển thị ở góc trên bên phải màn hình
              </p>
            </div>
            <button
              type="submit"
              disabled={isLoadingName}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-blue-500/50 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoadingName ? 'Đang cập nhật...' : 'Cập nhật tên'}
            </button>
          </form>
        </div>

        {/* Email Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Email
          </h2>

          {emailSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
              <div className="flex items-center">
                <span className="mr-2 text-green-600 dark:text-green-400">✓</span>
                <p className="text-sm text-green-800 dark:text-green-300">{emailSuccess}</p>
              </div>
            </div>
          )}

          {emailError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
              <div className="flex items-center">
                <span className="mr-2 text-red-600 dark:text-red-400">⚠️</span>
                <p className="text-sm text-red-800 dark:text-red-300">{emailError}</p>
              </div>
            </div>
          )}

          {!showVerificationCode ? (
            // Email Update Form
            <form onSubmit={handleEmailSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Địa chỉ email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                  required
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Sau khi cập nhật, bạn cần xác thực email mới
                </p>
              </div>
              <button
                type="submit"
                disabled={isLoadingEmail}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-blue-500/50 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoadingEmail ? 'Đang gửi...' : 'Gửi mã xác thực'}
              </button>
            </form>
          ) : (
            // Verification Code Form
            <form onSubmit={handleVerificationSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mã xác thực
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-2xl tracking-widest
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="000000"
                  required
                  maxLength={6}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Nhập mã 6 chữ số đã được gửi đến <span className="font-medium">{pendingEmail}</span>
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoadingVerification}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-blue-500/50 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isLoadingVerification ? (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Đang xác thực...
                    </span>
                  ) : (
                    'Xác thực email'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowVerificationCode(false);
                    setVerificationCode('');
                    setPendingEmail('');
                    setEmailSuccess('');
                    setEmailError('');
                  }}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
                >
                  Hủy
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Password Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Đổi mật khẩu
          </h2>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
              <div className="flex items-center">
                <span className="mr-2 text-green-600 dark:text-green-400">✓</span>
                <p className="text-sm text-green-800 dark:text-green-300">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
              <div className="flex items-center">
                <span className="mr-2 text-red-600 dark:text-red-400">⚠️</span>
                <p className="text-sm text-red-800 dark:text-red-300">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mật khẩu hiện tại
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập mật khẩu hiện tại"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mật khẩu mới
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                required
                minLength={8}
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số
              </p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Xác nhận mật khẩu mới
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập lại mật khẩu mới"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-blue-500/50 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang xử lý...
                </span>
              ) : (
                'Đổi mật khẩu'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
