import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../src/contexts/AuthContext';
import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const router = useRouter();

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }

      try {
        const session = await fetchAuthSession();
        const accessToken = session.tokens?.accessToken;
        const idToken = session.tokens?.idToken;
        
        const tokenGroups = 
          accessToken?.payload?.['cognito:groups'] ||
          idToken?.payload?.['cognito:groups'];
        
        const adminEmails = ['nhanle221199@gmail.com'];
        
        const isAdminUser = 
          tokenGroups?.includes('Admins') || 
          adminEmails.includes(user?.attributes?.email || user?.username || '');
        
        setIsAdmin(isAdminUser);
      } catch (error) {
        console.error('Error checking admin:', error);
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  // Redirect logic
  useEffect(() => {
    if (!loading && !checkingAdmin) {
      // Not authenticated - redirect to login
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
      }
      // Authenticated but not admin - redirect to home
      else if (requireAdmin && !isAdmin) {
        router.push('/');
      }
    }
  }, [user, loading, isAdmin, checkingAdmin, requireAdmin, router]);

  // Show loading state
  if (loading || checkingAdmin) {
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
