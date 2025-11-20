import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../store/authStore';

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Not authenticated - redirect to login
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
      }
      // Authenticated but not admin - redirect to home
      else if (requireAdmin && !isAdmin) {
        router.push('/');
      }
    }
  }, [user, loading, isAdmin, requireAdmin, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Not authenticated or not authorized
  if (!user || (requireAdmin && !isAdmin)) {
    return null;
  }

  // Render children
  return <>{children}</>;
}
