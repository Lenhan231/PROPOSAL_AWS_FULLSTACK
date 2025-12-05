import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

/**
 * Protected Route Component
 * Bảo vệ các trang yêu cầu đăng nhập
 * Tự động redirect về /login nếu user chưa đăng nhập
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // Lưu URL hiện tại để redirect lại sau khi login
      const returnUrl = router.asPath;
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [user, loading, router]);

  // Hiển thị loading khi đang check authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Không render gì nếu chưa có user (đang redirect)
  if (!user) {
    return null;
  }

  // Render children nếu user đã đăng nhập
  return children;
}
