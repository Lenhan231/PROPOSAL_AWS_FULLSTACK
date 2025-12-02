# Admin Pending Page Documentation (`admin/pending.js`)

## Overview
The Admin Pending page is a dashboard for administrators to review, approve, or reject books uploaded by users. It provides a comprehensive interface for content moderation with real-time statistics and detailed book information.

## File Location
`FRONTEND/plutonium-main/pages/admin/pending.js`

## Access Control
- **Protected Route**: `<ProtectedRoute requireAdmin={true}>`
- **Admin Only**: Only users with admin privileges can access
- **Authentication Required**: Must be logged in with Cognito

## Features

### 1. Book Review Dashboard
Displays all books with status "PENDING" waiting for admin approval.

**Key Information Displayed:**
- Book title
- Author name
- Description
- Upload date
- Uploader information
- Book status
- Cover image/thumbnail

### 2. Approval System
Administrators can approve books to make them publicly available.

**Approval Process:**
1. Review book details
2. Click "Duyệt" (Approve) button
3. Confirmation dialog appears
4. Confirm approval
5. Book status changes to "APPROVED"
6. Book appears in public library
7. Success toast notification
8. List refreshes automatically

**Functions:**
```javascript
const handleApprove = async (bookId, title) => {
  if (!confirm(`Duyệt sách "${title}"?`)) return;
  
  try {
    await api.approveBook(bookId);
    showToast(`Đã duyệt sách "${title}"`, "success");
    await loadPendingBooks();
    await loadTotalBooks();
  } catch (err) {
    // Error handling with detailed logging
  }
}
```

**API Call:**
```javascript
// From lib/api.js
approveBook: async (bookId) => {
  return await api.put(`/books/${bookId}/approve`);
}
```

### 3. Rejection System with Reason
Administrators can reject books with a required explanation.

**Rejection Process:**
1. Click "Từ chối" (Reject) button
2. Modal dialog opens
3. Enter rejection reason (required)
4. Click confirm
5. Book status changes to "REJECTED"
6. Book removed from pending list
7. User receives rejection notification
8. Success toast with rejection reason

**Functions:**
```javascript
const handleRejectClick = (bookId, title) => {
  setRejectModal({ show: true, bookId, title });
  setRejectReason("");
}

const handleRejectConfirm = async () => {
  if (!rejectReason.trim()) {
    showToast("Vui lòng nhập lý do từ chối", "error");
    return;
  }
  
  try {
    await api.rejectBook(rejectModal.bookId, rejectReason);
    showToast(`Đã từ chối sách "${rejectModal.title}"`, "success");
    setBooks(books.filter(b => b.bookId !== rejectModal.bookId));
    setRejectModal({ show: false, bookId: null, title: "" });
  } catch (err) {
    // Error handling
  }
}
```

**API Call:**
```javascript
// From lib/api.js
rejectBook: async (bookId, reason) => {
  return await api.put(`/books/${bookId}/reject`, { reason });
}
```

### 4. Statistics Dashboard
Real-time statistics displayed in card format.

**Metrics:**
1. **Chờ duyệt (Pending)**
   - Count of books awaiting approval
   - Icon: ⏳
   - Color: Yellow

2. **Tổng sách (đã duyệt) (Total Approved)**
   - Count of all approved books in library
   - Icon: 📚
   - Color: Green

3. **Cần xử lý (Action Required)**
   - Displays "Có việc" if pending books exist
   - Displays "Trống" if no pending books
   - Icon: 🔔 or ✅
   - Color: Red (action needed) or Green (all clear)

**Functions:**
```javascript
const loadTotalBooks = async () => {
  try {
    const result = await api.searchBooks({ limit: 1000 });
    setTotalBooks(result.books?.length || 0);
  } catch (err) {
    console.error("Failed to load total books:", err);
  }
}
```

## State Management

### Book Data
```javascript
const [books, setBooks] = useState([]);           // Pending books list
const [totalBooks, setTotalBooks] = useState(0);  // Total approved books count
```

### UI States
```javascript
const [loading, setLoading] = useState(false);    // Loading indicator
const [error, setError] = useState("");           // Error messages
```

### Toast Notifications
```javascript
const [toast, setToast] = useState({ 
  show: false, 
  message: "", 
  type: "success" 
});
```

### Rejection Modal
```javascript
const [rejectModal, setRejectModal] = useState({ 
  show: false,      // Modal visibility
  bookId: null,     // Book to reject
  title: ""         // Book title for display
});
const [rejectReason, setRejectReason] = useState(""); // Rejection reason text
```

## Data Loading

### Initial Load
```javascript
useEffect(() => {
  loadPendingBooks();
  loadTotalBooks();
}, []);
```

### Load Pending Books
```javascript
const loadPendingBooks = async () => {
  try {
    setLoading(true);
    setError("");
    const result = await api.getPendingBooks();
    
    // Filter client-side to ensure only PENDING status
    const pendingOnly = (result.books || []).filter(
      book => book.status === 'PENDING'
    );
    
    // Log warning if backend returns non-PENDING books
    if (pendingOnly.length !== result.books?.length) {
      console.warn("⚠️ Backend returned non-PENDING books!");
    }
    
    setBooks(pendingOnly);
  } catch (err) {
    console.error("Failed to load pending books:", err);
    setError(err.response?.data?.message || 
             "Không thể tải danh sách sách chờ duyệt");
  } finally {
    setLoading(false);
  }
}
```

**API Endpoint:**
```javascript
// From lib/api.js
getPendingBooks: async () => {
  return await api.get('/books/pending');
}
```

## UI Components

### Layout Structure
```jsx
<ProtectedRoute requireAdmin={true}>
  <div className="min-h-screen bg-white dark:bg-black">
    <Head>
      <title>Admin - Sách chờ duyệt</title>
    </Head>
    <Header />
    
    <main className="px-4 py-12 mx-auto max-w-7xl">
      {/* Header Section */}
      <h1>Admin Dashboard</h1>
      <p>Quản lý sách chờ duyệt từ người dùng</p>
      
      {/* Error Message */}
      {error && <ErrorAlert />}
      
      {/* Loading State */}
      {loading && <LoadingSpinner />}
      
      {/* Stats Cards */}
      {!loading && <StatsGrid />}
      
      {/* Pending Books List */}
      {!loading && <PendingBooksList />}
    </main>
    
    <Footer />
  </div>
  
  {/* Reject Modal */}
  {rejectModal.show && <RejectModal />}
  
  {/* Toast Notification */}
  <Toast />
</ProtectedRoute>
```

### StatCard Component
```jsx
function StatCard({ title, value, icon, color }) {
  const colorClasses = {
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  };
  
  return (
    <div className={`p-6 border rounded-xl ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}
```

### PendingBookCard Component
```jsx
function PendingBookCard({ book, onApprove, onReject }) {
  return (
    <div className="p-6 border border-gray-200 rounded-lg dark:border-gray-700 hover:shadow-lg transition-shadow">
      {/* Book Info */}
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div className="w-24 h-32 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0">
          {book.thumbnail ? (
            <img src={book.thumbnail} alt={book.title} className="w-full h-full object-cover rounded" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-4xl">
              📚
            </div>
          )}
        </div>
        
        {/* Details */}
        <div className="flex-grow">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {book.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            <span className="font-medium">Tác giả:</span> {book.author}
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            <span className="font-medium">Người upload:</span> {book.uploadedBy}
          </p>
          {book.description && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-3 line-clamp-2">
              {book.description}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Upload: {new Date(book.uploadDate).toLocaleDateString('vi-VN')}
          </p>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => onApprove(book.bookId, book.title)}
          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          ✅ Duyệt
        </button>
        <button
          onClick={() => onReject(book.bookId, book.title)}
          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          ❌ Từ chối
        </button>
      </div>
    </div>
  );
}
```

### Reject Modal
```jsx
{rejectModal.show && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Từ chối sách
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Sách: <span className="font-medium">{rejectModal.title}</span>
      </p>
      
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Lý do từ chối *
      </label>
      <textarea
        value={rejectReason}
        onChange={(e) => setRejectReason(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
        rows="4"
        placeholder="Nhập lý do từ chối..."
      />
      
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => {
            setRejectModal({ show: false, bookId: null, title: "" });
            setRejectReason("");
          }}
          className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
        >
          Hủy
        </button>
        <button
          onClick={handleRejectConfirm}
          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
        >
          Xác nhận từ chối
        </button>
      </div>
    </div>
  </div>
)}
```

## Book Status Constants
```javascript
// From lib/constants.js
export const BOOK_STATUS = {
  PENDING: 'PENDING',     // Waiting for admin review
  APPROVED: 'APPROVED',   // Approved and visible to users
  REJECTED: 'REJECTED'    // Rejected with reason
};
```

## Error Handling

### Comprehensive Logging
```javascript
// Approve error logging
console.error("=== APPROVE ERROR DETAILS ===");
console.error("Full error:", err);
console.error("Response data:", err.response?.data);
console.error("Response status:", err.response?.status);

// Reject error logging
console.error("=== REJECT ERROR DETAILS ===");
console.error("Full error:", err);
console.error("Response data:", err.response?.data);
console.error("Response status:", err.response?.status);
console.error("Response headers:", err.response?.headers);
```

### User-Friendly Error Messages
```javascript
const errorMsg = err.response?.data?.message || 
                err.response?.data?.error || 
                "Không thể duyệt sách";
showToast(errorMsg, "error");
```

### Load Error Display
```jsx
{error && (
  <div className="p-4 mb-6 text-red-800 bg-red-100 border border-red-300 rounded-lg">
    <p className="font-medium">Lỗi</p>
    <p className="text-sm">{error}</p>
  </div>
)}
```

## Client-Side Filtering

### Status Validation
The page includes client-side filtering to ensure only PENDING books are displayed, even if the backend returns books with other statuses:

```javascript
const pendingOnly = (result.books || []).filter(
  book => book.status === 'PENDING'
);

if (pendingOnly.length !== result.books?.length) {
  console.warn("⚠️ Backend returned non-PENDING books! Filtering on client side.");
  const nonPending = result.books.filter(b => b.status !== 'PENDING');
  console.log("Non-PENDING books:", nonPending.map(b => ({ 
    id: b.bookId, 
    status: b.status, 
    title: b.title 
  })));
}
```

This provides an extra layer of security and ensures data consistency.

## Toast Notifications

### Toast Component
```javascript
const showToast = (message, type = "success") => {
  setToast({ show: true, message, type });
};

const closeToast = () => {
  setToast({ show: false, message: "", type: "success" });
};
```

### Toast Types
- **success**: Green background for successful operations
- **error**: Red background for failed operations

### Auto-dismiss
Toast notifications automatically dismiss after a few seconds (implemented in Toast component).

## Loading States

### Full Page Loading
```jsx
{loading && (
  <div className="py-16 text-center">
    <div className="inline-block w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
    <p className="mt-4 text-gray-600 dark:text-gray-400">Đang tải...</p>
  </div>
)}
```

### Empty State
```jsx
{books.length === 0 && (
  <div className="py-16 text-center">
    <p className="text-xl text-gray-500 dark:text-gray-400">
      Không có sách nào chờ duyệt
    </p>
  </div>
)}
```

## Backend Integration

### API Endpoints

**GET /books/pending**
- Returns list of books with status PENDING
- Admin authentication required
- Response: `{ books: [...] }`

**PUT /books/{bookId}/approve**
- Changes book status to APPROVED
- Makes book visible in public library
- Admin authentication required
- Response: `{ message: "Book approved" }`

**PUT /books/{bookId}/reject**
- Changes book status to REJECTED
- Stores rejection reason
- Notifies uploader
- Admin authentication required
- Body: `{ reason: string }`
- Response: `{ message: "Book rejected" }`

**GET /books/search**
- Used to count total approved books
- Public endpoint
- Parameters: `{ limit: 1000 }`
- Response: `{ books: [...], total: number }`

## Security Features

### Admin-Only Access
```jsx
<ProtectedRoute requireAdmin={true}>
  {/* Page content */}
</ProtectedRoute>
```

### Admin Detection
From Header.js and ProtectedRoute.js:
```javascript
// Check if user is admin via Cognito groups
const isAdmin = user?.signInUserSession?.accessToken?.payload?.['cognito:groups']?.includes('Admins');

// Or email whitelist
const adminEmails = ['nhanle221199@gmail.com'];
const isAdmin = adminEmails.includes(user?.attributes?.email);
```

### Protected API Calls
All API calls require valid JWT token from Cognito authentication.

## Best Practices

### Data Synchronization
- Reload pending books after approval/rejection
- Reload total books count after approval
- Remove rejected books from list immediately

### User Experience
- Confirmation dialog for approval
- Modal with reason input for rejection
- Clear success/error feedback
- Loading indicators during operations
- Auto-refresh after actions

### Error Recovery
- Detailed error logging for debugging
- User-friendly error messages
- Network error handling
- Failed operation notifications

## Workflow Diagram

```
User uploads book
    ↓
Book status = PENDING
    ↓
Admin views in pending list
    ↓
    ├─→ Admin approves
    │       ↓
    │   Status = APPROVED
    │       ↓
    │   Book appears in library
    │       ↓
    │   Uploader notified
    │
    └─→ Admin rejects
            ↓
        Enter rejection reason
            ↓
        Status = REJECTED
            ↓
        Book removed from pending
            ↓
        Uploader notified with reason
```

## Testing Checklist

### Functional Tests
- [ ] Load pending books successfully
- [ ] Display correct book count
- [ ] Approve book updates status and refreshes list
- [ ] Reject book with reason removes from list
- [ ] Rejection modal opens and closes correctly
- [ ] Toast notifications display correctly
- [ ] Error messages display for failed operations
- [ ] Loading state shows during API calls
- [ ] Empty state displays when no pending books
- [ ] Stats cards show correct values

### Access Control Tests
- [ ] Non-admin users cannot access page
- [ ] Unauthenticated users redirected to login
- [ ] Admin users can access page
- [ ] API calls include authentication token

### Edge Cases
- [ ] Handle network errors gracefully
- [ ] Handle empty response from backend
- [ ] Handle malformed book data
- [ ] Handle rejection without reason
- [ ] Handle rapid approve/reject clicks
- [ ] Handle backend returning non-PENDING books
- [ ] Dark mode displays correctly
- [ ] Responsive layout on mobile devices

## Future Enhancements

### Potential Features
1. **Bulk Actions** - Approve/reject multiple books at once
2. **Book Preview** - View PDF before approval
3. **Edit Metadata** - Correct title/author before approval
4. **Filtering** - Filter by date, uploader, category
5. **Sorting** - Sort by upload date, title, author
6. **Search** - Search within pending books
7. **History Log** - View approval/rejection history
8. **Notifications** - Email notifications for new uploads
9. **Categories** - Assign categories during approval
10. **Priority Queue** - Mark urgent reviews

### Performance
1. Pagination for large book lists
2. Virtual scrolling for many items
3. Lazy loading of book thumbnails
4. Caching of approved book count
5. Real-time updates with WebSocket

### Analytics
1. Time to approval metrics
2. Rejection rate statistics
3. Admin activity tracking
4. Upload quality trends
5. Most active uploaders
