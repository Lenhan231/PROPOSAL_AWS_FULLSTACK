# Forgot Password Flow - Implementation Guide

## ✅ Completed Features

### 1. Forgot Password Page (`/forgot-password`)
- User enters email
- Backend sends verification code via AWS Cognito
- Auto-redirects to reset page with email pre-filled
- Error handling for:
  - User not found
  - Rate limiting
  - Network errors

### 2. Reset Password Page (`/reset-password`)
- User enters:
  - Email (auto-filled from previous step)
  - 6-digit verification code
  - New password (with strength validation)
  - Password confirmation
- Password requirements:
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 number
- Show/hide password toggle
- Error handling for:
  - Invalid code
  - Expired code
  - Weak password
  - Password mismatch

### 3. Login Page Integration
- Added "Quên mật khẩu?" link below login button
- Styled to match existing design

## 🔄 User Flow

```
1. User clicks "Quên mật khẩu?" on login page
   ↓
2. User enters email on /forgot-password
   ↓
3. Backend sends verification code to email
   ↓
4. Auto-redirect to /reset-password?email=xxx
   ↓
5. User enters code + new password
   ↓
6. Success → Redirect to /login
```

## 🎨 Features Included

- ✅ Dark mode support
- ✅ Responsive design
- ✅ Loading states
- ✅ Success/error messages with clear styling
- ✅ Real-time password validation
- ✅ Show/hide password toggle
- ✅ Auto-redirect on success
- ✅ Vietnamese localization
- ✅ Help text and tips
- ✅ Back navigation links

## 🧪 How to Test

### Local Testing

1. Start dev server:
```bash
cd FRONTEND/plutonium-main
npm run dev
```

2. Test flow:
   - Go to http://localhost:3000/login
   - Click "Quên mật khẩu?"
   - Enter a valid email (registered in Cognito)
   - Check email for verification code
   - Enter code + new password
   - Should redirect to login

### Production Testing

- Same flow on: https://fe-ken.d19yocdajp91pq.amplifyapp.com/

## 🔧 Backend Integration

Uses existing AuthContext methods:
- `forgotPassword(email)` - Sends verification code
- `confirmForgotPassword(email, code, newPassword)` - Resets password

Both methods are already implemented in `src/contexts/AuthContext.js` using AWS Amplify Auth.

## 📝 Notes

- Verification code expires in 15 minutes (Cognito default)
- Rate limiting: 5 attempts per hour per email (Cognito default)
- Password policy enforced by Cognito User Pool settings
- All errors are user-friendly and localized in Vietnamese

## 🚀 Next Steps (Optional Enhancements)

- [ ] Add email verification during signup
- [ ] Add "Resend code" button with cooldown timer
- [ ] Add password strength meter visual indicator
- [ ] Add reCAPTCHA to prevent abuse
- [ ] Add email template customization in Cognito
- [ ] Add analytics tracking for password reset attempts
