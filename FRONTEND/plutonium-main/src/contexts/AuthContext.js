import { createContext, useContext, useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import {
  signUp,
  signIn,
  signOut,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchAuthSession,
  updatePassword,
  fetchUserAttributes,
} from 'aws-amplify/auth';
import awsConfig from "../aws-config.js";

// Cấu hình Amplify
Amplify.configure(awsConfig);

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Kiểm tra user hiện tại khi load app
  useEffect(() => {
    checkUser();
  }, []);

  // Kiểm tra user đã đăng nhập chưa
  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser({ ...currentUser, attributes });
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Đăng ký user mới
  const signUpUser = async ({ email, password }) => {
    try {
      setError(null);
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
          },
          autoSignIn: true,
        },
      });

      return { isSignUpComplete, userId, nextStep };
    } catch (err) {
      console.error('Sign up error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Xác thực mã code sau khi đăng ký
  const confirmSignUpUser = async (email, code) => {
    try {
      setError(null);
      const { isSignUpComplete, nextStep } = await confirmSignUp({
        username: email,
        confirmationCode: code,
      });
      return { isSignUpComplete, nextStep };
    } catch (err) {
      console.error('Confirm sign up error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Gửi lại mã xác thực
  const resendCode = async (email) => {
    try {
      setError(null);
      await resendSignUpCode({ username: email });
    } catch (err) {
      console.error('Resend code error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Đăng nhập
  const signInUser = async (email, password) => {
    try {
      setError(null);
      const { isSignedIn, nextStep } = await signIn({
        username: email,
        password,
      });

      if (isSignedIn) {
        await checkUser();
      }

      return { isSignedIn, nextStep };
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Đăng xuất
  const signOutUser = async () => {
    try {
      setError(null);
      await signOut();
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Quên mật khẩu
  const forgotPassword = async (email) => {
    try {
      setError(null);
      const output = await resetPassword({ username: email });
      return output;
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Xác nhận reset mật khẩu
  const confirmForgotPassword = async (email, code, newPassword) => {
    try {
      setError(null);
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword,
      });
    } catch (err) {
      console.error('Confirm forgot password error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Đổi mật khẩu (khi đã đăng nhập)
  const changePassword = async (oldPassword, newPassword) => {
    try {
      setError(null);
      await updatePassword({ oldPassword, newPassword });
    } catch (err) {
      console.error('Change password error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Lấy token
  const getAccessToken = async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString();
    } catch (err) {
      console.error('Get access token error:', err);
      return null;
    }
  };

  // Lấy ID token (dùng cho API authorization)
  const getIdToken = async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString();
    } catch (err) {
      console.error('Get ID token error:', err);
      return null;
    }
  };

  const value = {
    user,
    loading,
    error,
    signUpUser,
    confirmSignUpUser,
    resendCode,
    signInUser,
    signOutUser,
    forgotPassword,
    confirmForgotPassword,
    changePassword,
    getAccessToken,
    getIdToken,
    checkUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
