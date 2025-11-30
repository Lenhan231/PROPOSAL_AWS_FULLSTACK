# Changelog - Frontend

## [0.2.0] - 2025-11-30

### ✨ Added - AWS Amplify Authentication & Settings

#### AWS Amplify Configuration
- **Environment Variables** (`.env.local`)
  - Added `NEXT_PUBLIC_REGION` - AWS region for Cognito
  - Added `NEXT_PUBLIC_COGNITO_USER_POOL_ID` - Cognito User Pool ID
  - Added `NEXT_PUBLIC_COGNITO_CLIENT_ID` - Cognito App Client ID
  - Added `NEXT_PUBLIC_COGNITO_DOMAIN` - Optional OAuth domain
  - Added `NEXT_PUBLIC_REDIRECT_URL` - OAuth redirect URL

- **AWS Config** (`src/aws-config.js`)
  - Added region configuration for Cognito
  - Added conditional OAuth configuration (only if domain is provided)
  - Added environment variable validation
  - Added debug logging for configuration values
  - Improved error messages for missing configuration

#### Authentication Features
- **AuthContext Updates** (`src/contexts/AuthContext.js`)
  - Added `updateUserAttribute` import from Amplify
  - Added `confirmUserAttribute` import for email verification
  - Added `updateEmail()` function - Update user email with verification flow
  - Added `verifyEmailUpdate()` function - Verify email with 6-digit code
  - Added `updateName()` function - Update user display name
  - Added `confirmSignInWithNewPassword()` function - Handle new password challenges
  - Modified `updateEmail()` to return result without auto-refresh (wait for verification)

- **Login Page** (`pages/login.js`)
  - Added password change flow for users created by admin
  - Added `needPasswordChange` state for challenge handling
  - Added `newPassword` state for new password input
  - Added `handleNewPasswordSubmit()` function
  - Added conditional rendering for new password form
  - Added handling for `CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED` challenge
  - Added password requirements display (8+ chars, uppercase, lowercase, numbers)
  - Added password visibility toggle for new password field

#### Settings Page (`pages/settings.js`)
- **Complete Rewrite** - Replaced mock implementation with real Amplify integration
  - Connected to `AuthContext` from `src/contexts/AuthContext`
  - Removed dependency on `store/authStore` (mock)
  - Removed dependency on `hooks/useSettings` (unused)

- **Account Information Section**
  - Added read-only display of User ID (Cognito username)
  - Added read-only display of current display name
  - Added read-only display of current email
  - Added card-based layout with icons for each field
  - Added visual distinction with background colors

- **Display Name Management**
  - Added form to update display name (name attribute)
  - Added `name` state management
  - Added `handleNameSubmit()` function with validation
  - Added separate loading state (`isLoadingName`)
  - Added separate success/error messages (`nameSuccess`, `nameError`)
  - Added real-time name validation (non-empty check)
  - Added info text: "Tên này sẽ hiển thị ở góc trên bên phải màn hình"

- **Email Management with Verification**
  - Added two-step email update flow:
    1. Enter new email → Send verification code
    2. Enter 6-digit code → Verify and update
  - Added `email` state for new email input
  - Added `verificationCode` state for 6-digit code
  - Added `showVerificationCode` state to toggle between forms
  - Added `pendingEmail` state to track email being verified
  - Added `handleEmailSubmit()` function - Send verification code
  - Added `handleVerificationSubmit()` function - Verify code
  - Added separate loading states (`isLoadingEmail`, `isLoadingVerification`)
  - Added auto-formatting for verification code (numbers only, max 6 digits)
  - Added large, centered verification code input with letter-spacing
  - Added "Cancel" button to return to email input form
  - Added display of pending email in verification form
  - Added info text about email verification requirement

- **Password Management**
  - Kept existing password change functionality
  - Added separate loading state (`isLoading`)
  - Added separate success/error messages (`successMessage`, `errorMessage`)
  - Added password strength requirements display
  - Improved error messages for password mismatch

- **UI/UX Improvements**
  - Added gradient background matching app theme
  - Added "Back to books" link with arrow icon
  - Added section headers with emojis (⚙️)
  - Added success/error message cards with icons (✓, ⚠️)
  - Added responsive button styling with hover effects
  - Added loading spinners for all async operations
  - Added disabled states for buttons during loading

#### Header Component Updates (`components/Header.js`)
- **Display Name Priority**
  - Changed display priority: Name → Email → Username
  - Updated button display: `user.attributes?.name || user.attributes?.email || user.username`
  - Updated dropdown display: Same priority order
  - Added fallback to 'User' if all fields are empty

- **Settings Link**
  - Added "⚙️ Cài đặt" link in user dropdown menu
  - Added click handler to close dropdown on navigation
  - Added hover effects for settings link
  - Positioned above logout button in dropdown

### 🔄 Changed

#### Configuration Changes
- **Environment Variables**
  - Fixed typo: Changed `app-southeast-1` to `ap-southeast-1` in region
  - Renamed `NEXT_PUBLIC_USER_POOL_ID` to `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
  - Renamed `NEXT_PUBLIC_CLIENT_ID` to `NEXT_PUBLIC_COGNITO_CLIENT_ID`
  - Added `NEXT_PUBLIC_REGION` as separate field

- **AWS Config Validation** (`src/aws-config.js`)
  - Changed validation to check actual config object values instead of process.env
  - Improved debug logging to show actual values from config
  - Added success message when all required fields are present
  - Made OAuth configuration conditional (only included if domain is set)

#### Authentication Flow
- **Login Process**
  - Now handles `CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED` step
  - Shows password change form instead of error for admin-created users
  - Continues to books page after password is successfully changed
  - Better error handling for various Cognito challenges

- **User Data Management**
  - Email updates now require verification before taking effect
  - Name updates reflect immediately in header
  - User data refreshes after successful name update
  - User data refreshes only after email verification (not after sending code)

#### UI/UX Improvements
- **Settings Page**
  - Changed from simple info display to full management interface
  - Separated concerns: View info → Update name → Update email → Change password
  - Added visual hierarchy with cards and sections
  - Improved mobile responsiveness
  - Better loading and error state handling

- **Header**
  - Now shows user's preferred name instead of username/email
  - Better fallback chain for display value
  - Settings menu more discoverable with icon

### 🐛 Fixed

#### Configuration Issues
- Fixed typo in region configuration (app-southeast-1 → ap-southeast-1)
- Fixed environment variable naming mismatch
- Fixed missing region in Cognito configuration
- Fixed validation checking wrong variables (process.env vs actual config)

#### Authentication Issues
- Fixed "User Pool not configured" error by adding region
- Fixed environment variable validation
- Fixed OAuth configuration causing errors when domain not set
- Fixed "already a signed in user" error with better error handling

#### Settings Page Issues
- Fixed import error (wrong AuthContext path)
- Fixed missing functions (updateEmail, updateName)
- Fixed email update not requiring verification
- Fixed user data not refreshing after updates

### 📦 Dependencies

No new dependencies added. Using existing:
- `aws-amplify@6.15.8` - AWS Amplify library
- `@aws-amplify/ui-react@6.13.1` - Amplify UI components

### 🧪 Testing

#### Verified Features
- ✅ Login works with real Cognito credentials
- ✅ Password change challenge works for admin-created users
- ✅ Display name update works and reflects in header
- ✅ Email update sends verification code
- ✅ Email verification with 6-digit code works
- ✅ Password change in settings works
- ✅ Settings link appears in user dropdown
- ✅ Account info displays correctly (User ID, Name, Email)
- ✅ All success/error messages display properly
- ✅ Loading states work for all operations
- ✅ Cancel button in email verification works
- ✅ Header displays name → email → username priority

#### Test Instructions
1. **Setup**:
   - Add Cognito credentials to `.env.local`
   - Restart Next.js dev server
   - Create user in Cognito console or use signup

2. **Login**:
   - If admin-created user, will prompt for new password
   - Enter new password (8+ chars, uppercase, lowercase, numbers)
   - Should redirect to books page

3. **Settings**:
   - Click username in header → Click "⚙️ Cài đặt"
   - View current User ID, Name, and Email
   - Update display name → Should see in header immediately
   - Update email → Enter code from email → Should verify successfully
   - Change password → Should show success message

### 📊 Progress

- **Phase 1 (Infrastructure)**: ✅ 100% Complete
- **Phase 2 (Authentication & Settings)**: ✅ 100% Complete
- **Phase 3 (Page Logic)**: ⏳ 0% Complete
- **Overall Progress**: 50% Complete

### 🚀 Next Steps (Phase 3)

1. Update `pages/upload.js` with real upload functionality
2. Update `pages/books.js` with book search and display
3. Update `pages/my-uploads.js` with user's uploaded books
4. Complete `pages/admin/pending.js` with approval workflow
5. Create `pages/read/[bookId].js` for book reader
6. Integrate with backend API endpoints
7. Add file upload to S3 with pre-signed URLs
8. Add book approval workflow

### 📝 Notes

- AWS Amplify v6 is fully integrated and working
- Email verification is required for email updates (security best practice)
- Display name updates are immediate (no verification needed)
- Password requirements: Minimum 8 characters, uppercase, lowercase, and numbers
- All Cognito operations use the new Amplify v6 API

### 🔐 Security

- Email updates require verification with 6-digit code sent to new email
- Password changes require current password verification
- JWT tokens automatically managed by Amplify
- Secure password requirements enforced
- User attributes properly validated before updates

---

## [0.1.0] - 2025-01-20

### ✨ Added - Phase 1 Complete

#### Configuration & Setup
- Added `.env.example` - Environment variables template
- Added `.env.local` - Local development configuration
- Added `lib/amplify-config.js` - AWS Amplify configuration
- Installed all required dependencies including React Query Devtools

#### Core Libraries
- Added `lib/constants.js` - All constants (API endpoints, status, validation)
- Added `lib/errorHandler.js` - Consistent error handling utilities
- Added `lib/api.js` - Axios client with JWT interceptors
- Added `lib/auth.js` - Authentication utilities (Mock + Real Amplify ready)

#### State Management
- Added `store/authStore.js` - AuthContext Provider for authentication
- Added `store/uiStore.js` - Zustand store for UI state (modals, toasts)

#### Custom Hooks
- Added `hooks/useBooks.js` - 6 hooks for books data management
  - `useSearchBooks` - Search books by title or author
  - `useReadUrl` - Get CloudFront signed URL for reading
  - `useMyUploads` - Get user's uploaded books
  - `usePendingBooks` - Get pending books (Admin)
  - `useApproveBook` - Approve book mutation (Admin)
  - `useRejectBook` - Reject book mutation (Admin)
- Added `hooks/useUpload.js` - Upload flow hook with validation

#### Components
- Added `components/ProtectedRoute.js` - Route protection wrapper
- Added `components/Toast.js` - Toast notification system

#### Documentation
- Added `README.md` - Main documentation
- Added `GETTING_STARTED.md` - Setup and installation guide
- Added `PROGRESS.md` - Implementation progress tracker
- Added `COMPLETED_PHASE1.md` - Phase 1 completion summary
- Added `PHASE2_CHECKLIST.md` - Phase 2 tasks checklist
- Added `SUMMARY.md` - Project summary
- Added `QUICK_REFERENCE.md` - Developer cheat sheet
- Added `VERIFICATION_CHECKLIST.md` - Setup verification checklist
- Added `INSTALL_NOTES.md` - Dependency installation notes
- Added `CHANGELOG.md` - This file

### 🔄 Changed

#### Updated Existing Files
- **`pages/_app.js`**
  - Added QueryClientProvider for TanStack Query
  - Added AuthProvider for authentication state
  - Added ToastContainer for notifications
  - Added React Query Devtools

- **`components/Header.js`**
  - Added auth state integration
  - Added user info display when logged in
  - Added logout button
  - Added admin link for admin users

- **`pages/login.js`**
  - Connected to AuthContext
  - Added role-based redirect (Admin → /admin/pending, User → /books)
  - Improved error handling

- **`pages/signup.js`**
  - Connected to AuthContext
  - Improved validation and error handling

- **`pages/admin/pending.js`**
  - Complete rewrite with better UI
  - Added ProtectedRoute with requireAdmin
  - Added mock pending books display
  - Added approve/reject buttons
  - Added stats cards
  - Added info box with admin notes
  - Ready for Phase 2 API integration

### 🎯 Features

#### Authentication
- ✅ Mock authentication system (works without backend)
- ✅ Login/Logout functionality
- ✅ User role detection (User/Admin)
- ✅ Protected routes with auto-redirect
- ✅ JWT token management (ready for real Cognito)

#### State Management
- ✅ TanStack Query for server state
- ✅ Zustand for client/UI state
- ✅ React Context for auth state
- ✅ React Query Devtools for debugging

#### API Integration
- ✅ Axios client with interceptors
- ✅ Automatic JWT token injection
- ✅ Auto-refresh token on 401
- ✅ Consistent error handling
- ✅ All API methods defined

#### UI/UX
- ✅ Toast notifications (success, error, warning, info)
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Loading states
- ✅ Error states
- ✅ User info in header

#### Admin Features
- ✅ Admin dashboard with stats
- ✅ Pending books list
- ✅ Approve/Reject buttons (mock)
- ✅ Role-based access control
- ✅ Auto-redirect to admin page on login

### 📦 Dependencies

#### Added
- `@tanstack/react-query@5.90.10` - Server state management
- `@tanstack/react-query-devtools@5.90.2` - React Query debugging

#### Already Installed
- `axios@1.13.2` - HTTP client
- `zustand@5.0.8` - Client state management
- `next@16.0.3` - React framework
- `next-themes@0.2.1` - Dark mode
- `react@18.2.0` - React library
- `tailwindcss@3.3.5` - CSS framework

### 🧪 Testing

#### Test Accounts (Mock)
- **User**: `user@example.com` / `Password123!`
- **Admin**: `admin@example.com` / `Admin123!`

#### Verified Features
- ✅ Login with user account → redirects to /books
- ✅ Login with admin account → redirects to /admin/pending
- ✅ Logout works correctly
- ✅ Protected routes redirect to login
- ✅ Admin routes redirect non-admins to home
- ✅ Toast notifications appear
- ✅ Dark mode toggle works
- ✅ Build succeeds without errors

### 📊 Progress

- **Phase 1 (Infrastructure)**: ✅ 100% Complete
- **Phase 2 (Page Logic)**: ⏳ 0% Complete
- **Overall Progress**: 40% Complete

### 🚀 Next Steps (Phase 2)

1. Update `pages/upload.js` with useUpload hook
2. Update `pages/books.js` with useSearchBooks hook
3. Update `pages/my-uploads.js` with useMyUploads hook
4. Complete `pages/admin/pending.js` with real API integration
5. Create `pages/books/[bookId].js` for book reader
6. Install react-pdf and epub.js
7. Add loading skeletons
8. Add modal component

### 🐛 Known Issues

- None! All features working as expected.

### 📝 Notes

- Using mock authentication for independent frontend development
- Real AWS Cognito code is ready but commented out
- All API calls will work once backend is ready
- Documentation is comprehensive and up-to-date

---

## How to Use This Changelog

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

### Categories
- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security fixes

---

**Last Updated**: 2025-01-20
**Version**: 0.1.0 (Phase 1 Complete)
