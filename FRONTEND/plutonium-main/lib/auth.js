// Mock Auth utilities (will be replaced with real Amplify when backend is ready)
// This allows frontend to work independently without backend

const MOCK_USERS = [
  {
    id: 'user-1',
    email: 'user@example.com',
    password: 'Password123!',
    name: 'Test User',
    groups: ['Users'],
  },
  {
    id: 'admin-1',
    email: 'admin@example.com',
    password: 'Admin123!',
    name: 'Admin User',
    groups: ['Admins'],
  },
];

const STORAGE_KEY = 'mock_auth_user';

/**
 * Sign in user
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} User object
 */
export async function signIn(email, password) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  const user = MOCK_USERS.find(u => u.email === email && u.password === password);
  
  if (!user) {
    throw new Error('Email hoặc mật khẩu không đúng');
  }

  // Store user in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  return user;
}

/**
 * Sign up new user
 * @param {Object} data - { email, password, name }
 * @returns {Promise<Object>} User object
 */
export async function signUp({ email, password, name }) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Check if user already exists
  const exists = MOCK_USERS.find(u => u.email === email);
  if (exists) {
    throw new Error('Email đã được sử dụng');
  }

  // In real app, this would create user in Cognito
  console.log('Mock signup:', { email, name });
  
  return { email, name };
}

/**
 * Sign out user
 */
export async function signOut() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Get current authenticated user
 * @returns {Promise<Object|null>} User object or null
 */
export async function getCurrentUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  const userStr = localStorage.getItem(STORAGE_KEY);
  if (!userStr) {
    return null;
  }

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Get access token (JWT)
 * @returns {Promise<string|null>} Access token
 */
export async function getAccessToken() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  // In real app, this would return actual JWT from Cognito
  // For now, return a mock token
  return `mock_token_${user.id}`;
}

/**
 * Check if user is admin
 * @param {Object} user - User object
 * @returns {boolean}
 */
export function isAdmin(user) {
  if (!user || !user.groups) {
    return false;
  }
  return user.groups.includes('Admins');
}

/**
 * Forgot password
 * @param {string} email
 */
export async function forgotPassword(email) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('Mock forgot password for:', email);
}

/**
 * Reset password
 * @param {string} email
 * @param {string} code
 * @param {string} newPassword
 */
export async function resetPassword(email, code, newPassword) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('Mock reset password for:', email);
}

// ============================================
// Real Amplify Auth (commented out for now)
// Uncomment when backend is ready
// ============================================

/*
import { Amplify, Auth } from 'aws-amplify';
import { amplifyConfig } from './amplify-config';

// Configure Amplify
Amplify.configure(amplifyConfig);

export async function signIn(email, password) {
  const user = await Auth.signIn(email, password);
  return user;
}

export async function signUp({ email, password, name }) {
  const result = await Auth.signUp({
    username: email,
    password,
    attributes: {
      email,
      name,
    },
  });
  return result;
}

export async function signOut() {
  await Auth.signOut();
}

export async function getCurrentUser() {
  try {
    const user = await Auth.currentAuthenticatedUser();
    return user;
  } catch {
    return null;
  }
}

export async function getAccessToken() {
  try {
    const session = await Auth.currentSession();
    return session.getAccessToken().getJwtToken();
  } catch {
    return null;
  }
}

export function isAdmin(user) {
  if (!user) return false;
  const groups = user.signInUserSession?.accessToken?.payload['cognito:groups'] || [];
  return groups.includes('Admins');
}

export async function forgotPassword(email) {
  await Auth.forgotPassword(email);
}

export async function resetPassword(email, code, newPassword) {
  await Auth.forgotPasswordSubmit(email, code, newPassword);
}
*/
