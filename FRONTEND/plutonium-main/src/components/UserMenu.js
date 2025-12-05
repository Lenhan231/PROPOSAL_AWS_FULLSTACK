import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import Link from 'next/link';

/**
 * User Menu Component
 * Hiển thị thông tin user và nút đăng xuất
 */
export default function UserMenu() {
  const { user, signOutUser, loading } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOutUser();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center space-x-4">
        <Link 
          href="/login"
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
        >
          Đăng nhập
        </Link>
        <Link 
          href="/signup"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  const userName = user.attributes?.name || user.username || 'User';
  const userEmail = user.attributes?.email || '';

  return (
    <div className="relative group">
      <button className="flex items-center space-x-3 focus:outline-none">
        {/* Avatar */}
        <div className="flex items-center justify-center w-10 h-10 font-semibold text-white bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
          {userName.charAt(0).toUpperCase()}
        </div>
        {/* User Name (Desktop only) */}
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {userName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {userEmail}
          </p>
        </div>
        {/* Dropdown Icon */}
        <svg 
          className="w-4 h-4 text-gray-500 transition-transform group-hover:rotate-180" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <div className="absolute right-0 z-50 hidden w-56 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg group-hover:block dark:bg-gray-800 dark:border-gray-700">
        {/* User Info (Mobile) */}
        <div className="px-4 py-3 border-b border-gray-200 md:hidden dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {userName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {userEmail}
          </p>
        </div>

        {/* Menu Items */}
        <div className="py-2">
          <Link 
            href="/books"
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            📚 Thư viện
          </Link>
          <Link 
            href="/my-uploads"
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            📤 Upload của tôi
          </Link>
          <Link 
            href="/upload"
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            ➕ Upload sách mới
          </Link>
          
          {/* Admin Links (if user is admin) */}
          {user.attributes?.['custom:role'] === 'admin' && (
            <>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
              <Link 
                href="/admin/pending"
                className="block px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
              >
                👑 Admin Panel
              </Link>
            </>
          )}
        </div>

        {/* Sign Out */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSignOut}
            className="block w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            🚪 Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
