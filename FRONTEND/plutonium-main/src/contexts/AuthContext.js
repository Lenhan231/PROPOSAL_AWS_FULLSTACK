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
  confirmSignIn,
  updateUserAttribute,
  confirmUserAttribute,
} from 'aws-amplify/auth';
import awsConfig from "../aws-config.js";

// Cấu hình Amplify
Amplify.configure(awsConfig);

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helpers to persist display name locally (avoid rollback to email on refresh)
  const persistDisplayName = (name) => {
    const value = name || '';
    setDisplayName(value || null);
    if (typeof window !== 'undefined') {
      if (value) localStorage.setItem('displayName', value);
      else localStorage.removeItem('displayName');
    }
  };

  const getCachedDisplayName = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('displayName') || null;
  };

  // Kiểm tra user hiện tại khi load app
  useEffect(() => {
    checkUser();
  }, []);

  // Kiểm tra user đã đăng nhập chưa
  const checkUser = async () => {
    try {
      const cachedName = displayName || getCachedDisplayName();
      const currentUser = await getCurrentUser();
      // Pull minimal attributes from token to avoid extra Cognito calls
      const session = await fetchAuthSession().catch(() => null);
      const idPayload = session?.tokens?.idToken?.payload || {};
      const accessPayload = session?.tokens?.accessToken?.payload || {};
      let attributes = {
        email: idPayload.email || accessPayload.username || '',
        sub: idPayload.sub || accessPayload.sub || currentUser?.userId || '',
        username: currentUser?.username || idPayload['cognito:username'] || '',
      };

      let profileData = null;
      try {
        profileData = await fetchUserProfile();
        if (profileData?.user_name) {
          attributes = { ...attributes, name: profileData.user_name };
        }
      } catch (profileErr) {
        console.warn('Unable to fetch profile from API:', profileErr);
      }

      setProfile(profileData);

      // Prefer DynamoDB profile name, then Cognito name, then keep existing displayName before falling back
      const nextDisplayName =
        profileData?.user_name ||
        attributes?.name ||
        cachedName ||
        attributes?.email ||
        currentUser?.username;
      if (profileData?.user_name || attributes?.name || cachedName) {
        persistDisplayName(profileData?.user_name || attributes?.name || cachedName);
      }
      setUser({ ...currentUser, attributes, profile: profileData, displayName: nextDisplayName });
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

  // Confirm sign in với new password (khi Cognito yêu cầu đổi mật khẩu)
  const confirmSignInWithNewPassword = async (newPassword) => {
    try {
      setError(null);
      const { isSignedIn, nextStep } = await confirmSignIn({
        challengeResponse: newPassword,
      });
      
      if (isSignedIn) {
        await checkUser();
      }
      
      return { isSignedIn, nextStep };
    } catch (err) {
      console.error('Confirm sign in error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Cập nhật email
  const updateEmail = async (newEmail) => {
    try {
      setError(null);
      const result = await updateUserAttribute({
        userAttribute: {
          attributeKey: 'email',
          value: newEmail,
        },
      });
      // Don't refresh user data yet - wait for verification
      return result;
    } catch (err) {
      console.error('Update email error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Xác thực email mới với mã code
  const verifyEmailUpdate = async (code) => {
    try {
      setError(null);
      await confirmUserAttribute({
        userAttributeKey: 'email',
        confirmationCode: code,
      });
      // Refresh user data after verification
      await checkUser();
      return true;
    } catch (err) {
      console.error('Verify email error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Cập nhật tên (name attribute)
  const updateName = async (newName) => {
    try {
      setError(null);
      const token = await getIdToken();
      if (!token) throw new Error('Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.');
      if (!process.env.NEXT_PUBLIC_API_URL) throw new Error('API endpoint chưa được cấu hình.');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_name: newName }),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(message || 'Không thể cập nhật tên. Vui lòng thử lại.');
      }

      // Update local state immediately
      setProfile((prev) => ({ ...(prev || {}), user_name: newName }));
      persistDisplayName(newName);
      setUser((prev) => {
        if (!prev) return prev;
        const updatedAttributes = { ...(prev.attributes || {}), name: newName };
        const updatedProfile = { ...(prev.profile || {}), user_name: newName };
        const displayName =
          newName ||
          prev.displayName ||
          updatedAttributes.email ||
          prev.username;
        return { ...prev, attributes: updatedAttributes, profile: updatedProfile, displayName };
      });

      await checkUser();
      return true;
    } catch (err) {
      console.error('Update name error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Lấy profile (tên hiển thị lưu trong DynamoDB)
  const fetchUserProfile = async () => {
    const token = await getIdToken();
    if (!token) throw new Error('Chưa đăng nhập');
    if (!process.env.NEXT_PUBLIC_API_URL) throw new Error('API endpoint chưa được cấu hình.');

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const message = await res.text().catch(() => '');
      throw new Error(message || `Lỗi ${res.status}`);
    }
    const profileData = await res.json();
    if (profileData?.user_name) {
      persistDisplayName(profileData.user_name);
    }
    return profileData;
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
      const session = await fetchAuthSession({ forceRefresh: true });
      return session.tokens?.idToken?.toString();
    } catch (err) {
      console.error('Get ID token error:', err);
      return null;
    }
  };

  const value = {
    user,
    profile,
    displayName: displayName || user?.displayName || profile?.user_name || user?.attributes?.name || user?.attributes?.email || user?.username,
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
    confirmSignInWithNewPassword,
    updateEmail,
    verifyEmailUpdate,
    updateName,
    fetchUserProfile,
    getAccessToken,
    getIdToken,
    checkUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
