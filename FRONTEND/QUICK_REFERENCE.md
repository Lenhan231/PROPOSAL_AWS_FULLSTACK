# Quick Reference - Frontend Cheat Sheet

## 🚀 Quick Commands

```bash
# Setup
cd FRONTEND/plutonium-main
npm install
npm run dev

# Build
npm run build
npm start

# Lint
npm run lint
```

---

## 🔑 Test Accounts

```javascript
// User
Email: user@example.com
Password: Password123!

// Admin
Email: admin@example.com
Password: Admin123!
```

---

## 📦 Import Cheat Sheet

### Hooks

```javascript
// Auth
import { useAuth } from '../store/authStore';
const { user, isAuthenticated, isAdmin, signIn, signOut } = useAuth();

// Books
import { useSearchBooks, useReadUrl, useMyUploads } from '../hooks/useBooks';
const { data, isLoading, error } = useSearchBooks({ title: 'aws' });

// Admin
import { usePendingBooks, useApproveBook, useRejectBook } from '../hooks/useBooks';
const approveMutation = useApproveBook();

// Upload
import { useUpload } from '../hooks/useUpload';
const { upload, uploadProgress, isUploading } = useUpload();

// UI Store
import { useUIStore, toast } from '../store/uiStore';
const { openModal, closeModal } = useUIStore();
toast.success('Success!');
```

### Components

```javascript
import ProtectedRoute from '../components/ProtectedRoute';
import ToastContainer from '../components/Toast';
import Header from '../components/Header';
import Footer from '../components/Footer';
```

### Utilities

```javascript
import { api } from '../lib/api';
import { handleApiError } from '../lib/errorHandler';
import { BOOK_STATUS, VALIDATION_RULES, API_ENDPOINTS } from '../lib/constants';
```

---

## 🎨 Common Patterns

### Protected Page

```javascript
import ProtectedRoute from '../components/ProtectedRoute';

export default function MyPage() {
  return (
    <ProtectedRoute>
      <div>Protected content</div>
    </ProtectedRoute>
  );
}
```

### Admin Page

```javascript
import ProtectedRoute from '../components/ProtectedRoute';

export default function AdminPage() {
  return (
    <ProtectedRoute requireAdmin={true}>
      <div>Admin only content</div>
    </ProtectedRoute>
  );
}
```

### Fetch Data

```javascript
import { useSearchBooks } from '../hooks/useBooks';

export default function BooksPage() {
  const { data, isLoading, error } = useSearchBooks({ title: 'aws' });
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  const books = data?.data || [];
  
  return (
    <div>
      {books.map(book => (
        <div key={book.bookId}>{book.title}</div>
      ))}
    </div>
  );
}
```

### Mutation

```javascript
import { useApproveBook } from '../hooks/useBooks';
import { toast } from '../store/uiStore';

export default function AdminPage() {
  const approveMutation = useApproveBook();
  
  const handleApprove = async (bookId) => {
    try {
      await approveMutation.mutateAsync(bookId);
      toast.success('Approved!');
    } catch (error) {
      toast.error('Failed!');
    }
  };
  
  return <button onClick={() => handleApprove('123')}>Approve</button>;
}
```

### Upload Flow

```javascript
import { useUpload } from '../hooks/useUpload';

export default function UploadPage() {
  const { upload, uploadProgress, isUploading } = useUpload();
  const [file, setFile] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await upload(file, {
      title: 'Book Title',
      author: 'Author Name',
      description: 'Description',
    });
    
    if (result.success) {
      router.push('/my-uploads');
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      {isUploading && <div>Progress: {uploadProgress}%</div>}
      <button disabled={isUploading}>Upload</button>
    </form>
  );
}
```

---

## 🎯 Status Badges

```javascript
import { STATUS_BADGE_CONFIG } from '../lib/constants';

function StatusBadge({ status }) {
  const badge = STATUS_BADGE_CONFIG[status];
  return (
    <span className={badge.className}>
      {badge.text}
    </span>
  );
}
```

---

## 🍞 Toast Notifications

```javascript
import { toast } from '../store/uiStore';

// Success
toast.success('Operation successful!');

// Error
toast.error('Something went wrong!');

// Warning
toast.warning('Please be careful!');

// Info
toast.info('FYI: Something happened');
```

---

## 🔍 React Query Devtools

```javascript
// Already included in _app.js
// Look for flower icon at bottom of screen
// Click to see:
// - Active queries
// - Query cache
// - Mutations
// - Query status
```

---

## 🎨 Tailwind Classes

### Common Patterns

```javascript
// Button Primary
className="px-6 py-3 font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"

// Button Secondary
className="px-6 py-3 font-medium text-gray-900 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-600"

// Input
className="w-full px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"

// Card
className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg"

// Loading Spinner
className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"
```

---

## 🐛 Debug Tips

### Check Auth State

```javascript
const { user, isAuthenticated, isAdmin } = useAuth();
console.log('User:', user);
console.log('Authenticated:', isAuthenticated);
console.log('Admin:', isAdmin);
```

### Check Query State

```javascript
const query = useSearchBooks({ title: 'aws' });
console.log('Data:', query.data);
console.log('Loading:', query.isLoading);
console.log('Error:', query.error);
console.log('Status:', query.status);
```

### Check API Calls

```javascript
// Open browser console
// Look for:
// [API] Request: ...
// [API] Response: ...
// [Error] ...
```

### React Query Devtools

- Click flower icon at bottom
- See all queries
- See cache
- See mutations
- Refetch manually

---

## 📝 Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_USER_POOL_ID=ap-southeast-1_XXXXXXXXX
NEXT_PUBLIC_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_REGION=ap-southeast-1
```

---

## 🔗 Useful Links

- **Docs**: Check `FRONTEND/` folder
- **Setup**: `GETTING_STARTED.md`
- **Progress**: `PROGRESS.md`
- **Tasks**: `PHASE2_CHECKLIST.md`

---

## 💡 Pro Tips

1. **Use React Query Devtools** - Best debugging tool
2. **Check console logs** - Errors are logged
3. **Use toast for feedback** - Better UX
4. **Test incrementally** - Don't wait until done
5. **Read error messages** - They're helpful
6. **Ask for help** - Team is here

---

## 🚨 Common Errors

### "useAuth must be used within AuthProvider"
→ Component not wrapped in AuthProvider (check _app.js)

### "Cannot read property 'data' of undefined"
→ Check if query is loading: `if (isLoading) return ...`

### "Network Error"
→ Check API_URL in .env.local

### "401 Unauthorized"
→ Token expired or invalid, try logout/login

---

**Keep this handy! 📌**
