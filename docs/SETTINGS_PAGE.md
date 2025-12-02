# Settings Page Documentation (`settings.js`)

## Overview
The Settings page provides users with comprehensive account management features including profile information display, password changes, email updates with verification, and display name management.

## File Location
`FRONTEND/plutonium-main/pages/settings.js`

## Component Structure

### Main Components
1. **Settings** - Wrapper component with ProtectedRoute
2. **SettingsContent** - Main content component with all functionality

## Features

### 1. Account Information Display
Displays read-only user information:
- **User ID** - Cognito username (unique identifier)
- **Display Name** - Current name from `user.attributes.name`
- **Email** - Current email from `user.attributes.email`

### 2. Display Name Update
**Form Fields:**
- Name input field (pre-filled with current name)

**Validation:**
- Name cannot be empty
- Whitespace is trimmed

**Process:**
1. User enters new name
2. Click "Cập nhật tên"
3. Calls `updateName()` from AuthContext
4. Updates `user.attributes.name` in Cognito
5. Success message displayed
6. Name updates immediately in UI and Header

**Functions:**
```javascript
const handleNameSubmit = async (e) => {
  e.preventDefault();
  // Validates name not empty
  // Calls updateName(name.trim())
  // Shows success/error message
}
```

### 3. Password Change
**Form Fields:**
- Current password
- New password
- Confirm new password

**Validation:**
- New password must be at least 8 characters
- New password and confirm password must match
- Current password must be correct

**Process:**
1. User enters current password and new password
2. Validates input
3. Calls `changePassword()` from AuthContext
4. Uses AWS Amplify's `updatePassword` API
5. Success message clears form
6. Error message if current password is incorrect

**Functions:**
```javascript
const handlePasswordSubmit = async (e) => {
  e.preventDefault();
  // Validates password length and match
  // Calls changePassword(currentPassword, newPassword)
  // Shows success/error message
}
```

**AWS Amplify API:**
```javascript
// From AuthContext
import { updatePassword } from 'aws-amplify/auth';
await updatePassword({ oldPassword, newPassword });
```

### 4. Email Update with Verification
**Two-Step Process:**

#### Step 1: Request Email Change
**Form Fields:**
- New email address

**Validation:**
- Email must be valid format (contains @)

**Process:**
1. User enters new email
2. Click "Cập nhật Email"
3. Calls `updateEmail()` from AuthContext
4. AWS Cognito sends 6-digit verification code to new email
5. Form switches to verification mode
6. Shows success message to check email

**Functions:**
```javascript
const handleEmailSubmit = async (e) => {
  e.preventDefault();
  // Validates email format
  // Calls updateEmail(email)
  // Sets showVerificationCode = true
  // Stores pendingEmail
}
```

#### Step 2: Verify Email with Code
**Form Fields:**
- 6-digit verification code

**Validation:**
- Code must be exactly 6 digits

**Process:**
1. User checks email and gets code
2. Enters 6-digit code
3. Click "Xác thực"
4. Calls `verifyEmailUpdate()` from AuthContext
5. AWS Cognito confirms email change
6. Updates `user.attributes.email`
7. Success message displayed
8. Form returns to normal mode

**Functions:**
```javascript
const handleVerificationSubmit = async (e) => {
  e.preventDefault();
  // Validates code length = 6
  // Calls verifyEmailUpdate(verificationCode)
  // Resets verification state
}
```

**AWS Amplify API:**
```javascript
// From AuthContext
import { updateUserAttribute, confirmUserAttribute } from 'aws-amplify/auth';

// Step 1: Request change
await updateUserAttribute({ 
  userAttribute: { attributeKey: 'email', value: newEmail } 
});

// Step 2: Confirm with code
await confirmUserAttribute({ 
  userAttributeKey: 'email', 
  confirmationCode: code 
});
```

## State Management

### Form States
```javascript
const [email, setEmail] = useState('');              // Email input
const [name, setName] = useState('');                // Name input
const [currentPassword, setCurrentPassword] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [verificationCode, setVerificationCode] = useState('');
```

### UI States
```javascript
const [showVerificationCode, setShowVerificationCode] = useState(false);
const [pendingEmail, setPendingEmail] = useState('');
```

### Loading States
```javascript
const [isLoading, setIsLoading] = useState(false);              // Password change
const [isLoadingEmail, setIsLoadingEmail] = useState(false);    // Email update
const [isLoadingVerification, setIsLoadingVerification] = useState(false); // Code verification
const [isLoadingName, setIsLoadingName] = useState(false);      // Name update
```

### Message States
```javascript
// Password messages
const [successMessage, setSuccessMessage] = useState('');
const [errorMessage, setErrorMessage] = useState('');

// Email messages
const [emailSuccess, setEmailSuccess] = useState('');
const [emailError, setEmailError] = useState('');

// Name messages
const [nameSuccess, setNameSuccess] = useState('');
const [nameError, setNameError] = useState('');
```

## User Experience

### Visual Feedback
1. **Loading Spinners** - Displayed during async operations
2. **Success Messages** - Green background with success text
3. **Error Messages** - Red background with error text
4. **Disabled Buttons** - During loading states
5. **Form Clearing** - Successful password change clears inputs

### Conditional Rendering
- Email form shows either:
  - Email input (normal mode)
  - Verification code input (verification mode)
- Success/error messages appear/disappear automatically

## Security Features

### Password Security
- Minimum 8 characters required
- Current password required for change
- Password confirmation prevents typos

### Email Security
- Two-factor verification required
- 6-digit code sent to new email
- Old email remains until verified
- Code expires after short time (AWS Cognito default)

### Protected Route
- Entire page wrapped in `ProtectedRoute`
- Requires authenticated user
- Redirects to login if not authenticated

## AWS Cognito Integration

### User Attributes
```javascript
user.username              // User ID (unique identifier)
user.attributes.name       // Display name (custom attribute)
user.attributes.email      // Email address (built-in attribute)
```

### Operations
1. **updatePassword** - Changes user password
2. **updateUserAttribute** - Updates email (sends verification code)
3. **confirmUserAttribute** - Confirms email with verification code
4. **updateUserAttribute** - Updates name (immediate, no verification)

## Error Handling

### Password Errors
- "Mật khẩu mới không khớp" - Passwords don't match
- "Mật khẩu phải có ít nhất 8 ký tự" - Password too short
- "Không thể đổi mật khẩu. Vui lòng kiểm tra mật khẩu hiện tại." - Wrong current password

### Email Errors
- "Vui lòng nhập email hợp lệ" - Invalid email format
- "Không thể cập nhật email. Vui lòng thử lại." - Update failed
- "Mã xác thực không đúng. Vui lòng thử lại." - Wrong verification code

### Name Errors
- "Tên không được để trống" - Empty name
- "Không thể cập nhật tên. Vui lòng thử lại." - Update failed

## UI Components

### Layout
```jsx
<ProtectedRoute>
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 py-12 px-4 sm:px-6 lg:px-8">
    <div className="max-w-3xl mx-auto">
      {/* Back Link */}
      {/* Title */}
      {/* Account Info Section */}
      {/* Display Name Section */}
      {/* Email Section */}
      {/* Password Section */}
    </div>
  </div>
</ProtectedRoute>
```

### Styling
- **Gradient Background** - Blue to purple gradient
- **Card Design** - White cards with shadows
- **Dark Mode Support** - Full dark mode styling
- **Responsive** - Mobile-friendly layout
- **Icons** - SVG icons for visual enhancement

## Integration Points

### AuthContext Dependencies
```javascript
const { 
  user,              // Current user object
  changePassword,    // Password change function
  updateEmail,       // Email update function
  verifyEmailUpdate, // Email verification function
  updateName         // Name update function
} = useAuth();
```

### Header Component
- Name changes reflect immediately in Header dropdown
- Uses `user.attributes.name` with fallback to email/username

## Usage Flow

### Typical User Journey

1. **View Account Info**
   - See User ID, current name, current email

2. **Update Display Name**
   - Enter new name → Click update → See success message
   - Name updates in Header immediately

3. **Change Email**
   - Enter new email → Click update → Check email for code
   - Enter 6-digit code → Click verify → Email updated

4. **Change Password**
   - Enter current password → Enter new password → Confirm
   - Click update → Password changed → Form cleared

## Best Practices

### Implementation
1. Separate loading states for each operation
2. Clear success/error messages between operations
3. Validate input before API calls
4. Provide clear user feedback
5. Reset forms after successful operations

### Security
1. Always require current password for password change
2. Email verification prevents unauthorized changes
3. Protected route ensures authenticated access
4. No sensitive data in error messages

### UX
1. Pre-fill current values in forms
2. Show verification form only when needed
3. Clear messages after successful operations
4. Disable buttons during loading
5. Provide helpful error messages

## Future Enhancements

### Potential Features
1. **Phone Number** - Add phone number attribute with verification
2. **Profile Picture** - Upload and display user avatar
3. **Two-Factor Auth** - Enable 2FA for additional security
4. **Session Management** - View and revoke active sessions
5. **Account Deletion** - Allow users to delete their accounts
6. **Change History** - Log of all account changes

### Performance
1. Debounce email validation
2. Add rate limiting for verification codes
3. Cache user attributes locally
4. Implement optimistic UI updates

## Testing Checklist

### Manual Testing
- [ ] Display name updates and reflects in Header
- [ ] Password change with correct current password
- [ ] Password change fails with wrong current password
- [ ] Email update sends verification code
- [ ] Email verification with correct code
- [ ] Email verification fails with wrong code
- [ ] All validation messages display correctly
- [ ] Loading states show during operations
- [ ] Error handling for network failures
- [ ] Dark mode displays correctly
- [ ] Responsive layout on mobile devices

### Edge Cases
- [ ] Empty form submissions
- [ ] Special characters in name/password
- [ ] Very long names/emails
- [ ] Multiple rapid submissions
- [ ] Network timeout during verification
- [ ] Code expiration handling
