# Phase 2 Checklist - Connect Pages to API

## 📋 Overview

Phase 2 focuses on connecting existing UI pages to the API infrastructure we built in Phase 1.

**Estimated Time**: 4-6 hours
**Difficulty**: Medium

---

## ✅ Task List

### 1. Update Upload Page (1 hour)

**File**: `pages/upload.js`

- [ ] Import `useUpload` hook from `hooks/useUpload`
- [ ] Import `ProtectedRoute` component
- [ ] Import `validateUploadMetadata` from `hooks/useUpload`
- [ ] Replace mock upload logic with `upload()` function
- [ ] Use `uploadProgress` from hook for progress bar
- [ ] Use `isUploading` for button disabled state
- [ ] Remove manual validation (use hook's validation)
- [ ] Wrap page content with `<ProtectedRoute>`
- [ ] Test upload flow

**Code Snippet**:
```javascript
import { useUpload, validateUploadMetadata } from '../hooks/useUpload';
import ProtectedRoute from '../components/ProtectedRoute';

export default function UploadPage() {
  const { upload, uploadProgress, isUploading } = useUpload();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate metadata
    const validation = validateUploadMetadata(formData);
    if (!validation.valid) {
      // Show errors
      return;
    }
    
    // Upload
    const result = await upload(file, formData);
    if (result.success) {
      // Reset form
      router.push('/my-uploads');
    }
  };
  
  return (
    <ProtectedRoute>
      {/* Existing UI */}
    </ProtectedRoute>
  );
}
```

---

### 2. Update Books Page (1 hour)

**File**: `pages/books.js`

- [ ] Import `useSearchBooks` hook
- [ ] Import `useState` for search state
- [ ] Replace mock books data with hook data
- [ ] Add loading state UI
- [ ] Add error state UI
- [ ] Add empty state UI
- [ ] Add debounce for search input (300ms)
- [ ] Ensure only 1 field (title OR author) is sent
- [ ] Test search flow

**Code Snippet**:
```javascript
import { useSearchBooks } from '../hooks/useBooks';
import { useState, useEffect } from 'react';

export default function BooksPage() {
  const [searchMode, setSearchMode] = useState('title');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Build search params (only 1 field)
  const searchParams = debouncedQuery ? {
    [searchMode]: debouncedQuery,
  } : {};
  
  const { data, isLoading, error } = useSearchBooks(searchParams);
  
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  
  const books = data?.data || [];
  
  return (
    // Existing UI with books from API
  );
}
```

---

### 3. Update My Uploads Page (45 min)

**File**: `pages/my-uploads.js`

- [ ] Import `useMyUploads` hook
- [ ] Import `ProtectedRoute` component
- [ ] Replace mock uploads data with hook data
- [ ] Add loading state UI
- [ ] Add error state UI
- [ ] Add empty state UI
- [ ] Wrap with `<ProtectedRoute>`
- [ ] Test my-uploads flow

**Code Snippet**:
```javascript
import { useMyUploads } from '../hooks/useBooks';
import ProtectedRoute from '../components/ProtectedRoute';

export default function MyUploadsPage() {
  const { data, isLoading, error } = useMyUploads();
  
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  
  const uploads = data?.data || [];
  
  return (
    <ProtectedRoute>
      {/* Existing UI with uploads from API */}
    </ProtectedRoute>
  );
}
```

---

### 4. Rewrite Admin Pending Page (1.5 hours)

**File**: `pages/admin/pending.js`

- [ ] Complete rewrite (current code is placeholder)
- [ ] Import `usePendingBooks`, `useApproveBook`, `useRejectBook`
- [ ] Import `ProtectedRoute` component
- [ ] Import `useUIStore` for modal
- [ ] Create rejection modal component
- [ ] Implement approve button handler
- [ ] Implement reject button handler (with modal)
- [ ] Add loading/error/empty states
- [ ] Wrap with `<ProtectedRoute requireAdmin={true}>`
- [ ] Test admin flow

**Code Snippet**:
```javascript
import { usePendingBooks, useApproveBook, useRejectBook } from '../hooks/useBooks';
import ProtectedRoute from '../components/ProtectedRoute';
import { useUIStore } from '../store/uiStore';

export default function AdminPendingPage() {
  const { data, isLoading } = usePendingBooks();
  const approveMutation = useApproveBook();
  const rejectMutation = useRejectBook();
  const { openModal, closeModal, modal } = useUIStore();
  
  const handleApprove = async (bookId) => {
    if (confirm('Duyệt sách này?')) {
      await approveMutation.mutateAsync(bookId);
    }
  };
  
  const handleReject = (bookId) => {
    openModal('reject', { bookId });
  };
  
  const handleRejectSubmit = async (reason) => {
    await rejectMutation.mutateAsync({
      bookId: modal.data.bookId,
      reason,
    });
    closeModal();
  };
  
  return (
    <ProtectedRoute requireAdmin={true}>
      {/* New UI implementation */}
      {modal.type === 'reject' && (
        <RejectModal onSubmit={handleRejectSubmit} onClose={closeModal} />
      )}
    </ProtectedRoute>
  );
}
```

---

### 5. Create Book Reader Page (2 hours)

**File**: `pages/books/[bookId].js` (NEW)

- [ ] Create new file
- [ ] Import `useReadUrl` hook
- [ ] Import `ProtectedRoute` component
- [ ] Install `react-pdf` and `epub.js`
- [ ] Create PDF viewer component
- [ ] Create ePub viewer component
- [ ] Add page navigation controls
- [ ] Add loading/error states
- [ ] Handle URL expiration (auto-refresh)
- [ ] Test reader flow

**Installation**:
```bash
npm install react-pdf epub.js
```

**Code Snippet**:
```javascript
import { useRouter } from 'next/router';
import { useReadUrl } from '../../hooks/useBooks';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Document, Page } from 'react-pdf';
import { useState } from 'react';

export default function BookReaderPage() {
  const router = useRouter();
  const { bookId } = router.query;
  const { data, isLoading, error } = useReadUrl(bookId);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  
  return (
    <ProtectedRoute>
      <div className="pdf-viewer">
        <Document
          file={data.readUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        >
          <Page pageNumber={pageNumber} />
        </Document>
        
        <div className="controls">
          <button onClick={() => setPageNumber(p => Math.max(1, p - 1))}>
            Previous
          </button>
          <span>Page {pageNumber} of {numPages}</span>
          <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}>
            Next
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
```

---

## 🎨 Additional Components to Create

### 6. Loading Skeleton Component (30 min)

**File**: `components/LoadingSkeleton.js` (NEW)

```javascript
export function BookCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      <div className="mt-4 h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="mt-2 h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
    </div>
  );
}
```

### 7. Modal Component (30 min)

**File**: `components/Modal.js` (NEW)

```javascript
export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
```

---

## 🧪 Testing Checklist

After completing each task, test:

### Upload Page
- [ ] Can access page when logged in
- [ ] Redirects to login when not logged in
- [ ] File validation works
- [ ] Upload progress shows
- [ ] Success toast appears
- [ ] Redirects to my-uploads after success

### Books Page
- [ ] Search by title works
- [ ] Search by author works
- [ ] Cannot search both at once
- [ ] Loading state shows
- [ ] Empty state shows when no results
- [ ] Error state shows on API error

### My Uploads Page
- [ ] Shows user's uploads
- [ ] Status badges correct
- [ ] Can click "Read" on approved books
- [ ] Shows rejection reason
- [ ] Loading state works

### Admin Page
- [ ] Only accessible by admin
- [ ] Shows pending books
- [ ] Approve button works
- [ ] Reject modal opens
- [ ] Reject with reason works
- [ ] List refreshes after action

### Book Reader
- [ ] PDF loads and displays
- [ ] Page navigation works
- [ ] URL auto-refreshes before expiry
- [ ] Error handling works

---

## 📊 Progress Tracking

**Total Tasks**: 7 main tasks + 2 components
**Estimated Time**: 6-8 hours
**Difficulty**: Medium

### Completion Status

- [ ] 1. Upload Page (1h)
- [ ] 2. Books Page (1h)
- [ ] 3. My Uploads Page (45min)
- [ ] 4. Admin Pending Page (1.5h)
- [ ] 5. Book Reader Page (2h)
- [ ] 6. Loading Skeleton (30min)
- [ ] 7. Modal Component (30min)

**Progress**: 0/7 tasks completed (0%)

---

## 🚀 Getting Started

1. Read this checklist completely
2. Start with Task 1 (Upload Page) - easiest
3. Test each task before moving to next
4. Use React Query Devtools to debug
5. Check console for errors
6. Ask for help if stuck

---

## 💡 Tips

- **Use React Query Devtools** - See query status, cache, errors
- **Check console logs** - Error messages are helpful
- **Test incrementally** - Don't wait until everything is done
- **Use toast notifications** - Good for user feedback
- **Handle loading states** - Better UX
- **Handle error states** - Show user-friendly messages

---

## 📞 Need Help?

- Check `GETTING_STARTED.md` for setup
- Check `PROGRESS.md` for overall status
- Check `COMPLETED_PHASE1.md` for what's available
- Ask team members
- Check React Query docs
- Check Next.js docs

---

**Good luck! 🎉**
