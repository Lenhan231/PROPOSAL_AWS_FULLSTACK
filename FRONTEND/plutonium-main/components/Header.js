import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../src/contexts/AuthContext";
import { fetchAuthSession } from "aws-amplify/auth";

export default function Header() {
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, signOutUser } = useAuth();
  const router = useRouter();

  // When mounted on client, now we can show the UI
  useEffect(() => setMounted(true), []);

  // Check if user is admin - use fetchAuthSession for Amplify v6
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        // Get tokens from Amplify v6
        const session = await fetchAuthSession();
        const accessToken = session.tokens?.accessToken;
        const idToken = session.tokens?.idToken;

        console.log('=== AUTH SESSION DEBUG ===');
        console.log('Access Token:', accessToken);
        console.log('ID Token:', idToken);
        console.log('Access Token Groups:', accessToken?.payload?.['cognito:groups']);
        console.log('ID Token Groups:', idToken?.payload?.['cognito:groups']);
        
        // Check groups from tokens
        const tokenGroups = 
          accessToken?.payload?.['cognito:groups'] ||
          idToken?.payload?.['cognito:groups'];
        
        // Email whitelist as fallback
        const adminEmails = ['nhanle221199@gmail.com'];
        
        const isAdminUser = 
          tokenGroups?.includes('Admins') || 
          adminEmails.includes(user?.attributes?.email || user?.username || '');

        console.log('Groups:', tokenGroups);
        console.log('Is Admin:', isAdminUser);
        console.log('========================');
        
        setIsAdmin(isAdminUser);
      } catch (error) {
        console.error('Error checking admin:', error);
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [user]);  const handleSignOut = async () => {
    try {
      await signOutUser();
      router.push("/");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  if (!mounted) return null;

  return (
    <header className="w-full sticky-nav">
      <div className="flex flex-col flex-wrap max-w-5xl p-2.5 mx-auto md:flex-row">
        <div className="flex flex-row items-center justify-between p-2 md:p-1">
          <Link href="/" className="flex items-center mb-4 space-x-2 text-2xl font-bold text-black transition duration-300 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 md:mb-0">
            <span>📚</span>
            <span>Thư Viện Online</span>
          </Link>
          <button
            className="px-3 py-1 pb-4 ml-auto text-black outline-none dark:text-gray-300 md:hidden"
            type="button"
            aria-label="button"
            onClick={() => setNavbarOpen(!navbarOpen)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <line x1="3" y1="6" y2="6" x2="21"></line>
              <line x1="3" y1="12" y2="12" x2="21"></line>
              <line x1="3" y1="18" y2="18" x2="21"></line>
            </svg>
          </button>
        </div>
        <div
          className={
            "md:flex flex-grow items-center" +
            (navbarOpen ? " flex" : " hidden")
          }
        >
          <div className="flex flex-wrap items-center justify-center pt-1 pl-2 ml-1 space-x-8 md:space-x-16 md:mx-auto md:pl-14">
            <Link href="/books" className="text-black transition duration-300 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              Khám phá
            </Link>
            <Link href="/upload" className="text-black transition duration-300 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              Tải lên
            </Link>
            <Link href="/my-uploads" className="text-black transition duration-300 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              Sách của tôi
            </Link>
            {isAdmin && (
              <Link href="/admin/pending" className="text-black transition duration-300 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-semibold">
                ⚙️ Admin
              </Link>
            )}
          </div>
          <button
            aria-label="Toggle Dark Mode"
            type="button"
            className="w-10 h-10 p-3 ml-5 mr-0 bg-gray-200 rounded md:ml-0 md:mr-5 dark:bg-gray-800"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                className="w-4 h-4 text-gray-800 dark:text-gray-200"
              >
                {theme === "dark" ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                ) : (
                  <svg className="svg-icon" viewBox="0 0 20 20">
                    <path
                      fill="none"
                      d="M10.544 8.717l1.166-.855 1.166.855-.467-1.399 1.012-.778h-1.244l-.467-1.243-.466 1.244H10l1.011.778-.467 1.398zm5.442.855l-.467 1.244h-1.244l1.011.777-.467 1.4 1.167-.855 1.165.855-.466-1.4 1.011-.777h-1.244l-.466-1.244zm-8.979-3.02c0-2.259.795-4.33 2.117-5.955A9.418 9.418 0 00.594 9.98c0 5.207 4.211 9.426 9.406 9.426 2.94 0 5.972-1.354 7.696-3.472-.289.026-.987.044-1.283.044-5.194.001-9.406-4.219-9.406-9.426M10 18.55c-4.715 0-8.551-3.845-8.551-8.57 0-3.783 2.407-6.999 5.842-8.131a10.32 10.32 0 00-1.139 4.703c0 5.368 4.125 9.788 9.365 10.245A9.733 9.733 0 0110 18.55m9.406-16.246h-1.71l-.642-1.71-.642 1.71h-1.71l1.39 1.069-.642 1.924 1.604-1.176 1.604 1.176-.642-1.924 1.39-1.069z"
                    />
                  </svg>
                )}
              </svg>
            )}
          </button>
          
          {/* Auth Section */}
          {user ? (
            // User is logged in - show email and logout
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 px-3 py-1.5 text-black dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition duration-300"
              >
                <span className="text-sm">👤</span>
                <span className="text-sm max-w-[150px] truncate">
                  {user.username || user.email || 'User'}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Đăng nhập với</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.username || user.email}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-200"
                  >
                    🚪 Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            // User is not logged in - show login/signup buttons
            <>
              <Link
                href="/login"
                className="invisible dark:hover:border-blue-500 hover:shadow-md transition duration-300 mr-4 text-black border px-3 py-1.5 rounded dark:text-gray-300 md:visible"
              >
                Đăng nhập
              </Link>
              <Link
                href="/signup"
                className="invisible md:visible px-3 py-1.5 transition-colors hover:bg-blue-700 text-white bg-blue-600 rounded"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
