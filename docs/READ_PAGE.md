# Read/Preview Page Documentation

## Overview
The `/read/[bookId]` page provides a book preview experience with download functionality. Users can view book details, preview the PDF content, and download the full book to their device.

**Route**: `/read/[bookId]`  
**File**: `pages/read/[bookId].js`  
**Authentication**: Required (Protected Route)  
**Access Level**: All authenticated users

---

## Features

### 1. **Book Information Card**
Displays comprehensive book metadata in an attractive card layout:
- **Book Cover**: Gradient placeholder with book emoji (📚)
- **Title**: Main book title
- **Author**: Book author name
- **Description**: Book description/summary (if available)
- **Upload Date**: When the book was added to library
- **Page Count**: Number of pages (if available)

### 2. **PDF Preview**
- Embedded PDF viewer using `<object>` and `<iframe>` tags
- Full content viewable inline within the page
- Responsive sizing (adapts to screen size)
- Fallback iframe if object tag not supported
- Uses signed S3 URL with `Content-Disposition: inline`

### 3. **Download Functionality**
Two download button locations:
- **Header**: Quick access download button in sticky header
- **Bottom CTA**: Large call-to-action section encouraging download

Download features:
- One-click download with proper filename
- Loading state with spinner during download
- Uses signed S3 URL with `Content-Disposition: attachment`
- Downloads as `.pdf` file to user's device

### 4. **Preview Notice**
Blue information banner that explains:
- User is viewing a preview version
- Instructions to download for offline reading
- Visual info icon for clarity

### 5. **Responsive Design**
- Mobile-friendly layout
- Sticky header for easy navigation
- Flexible grid system
- Dark mode support throughout

---

## User Interface Components

### Header (Sticky)
```
[← Quay lại]    [Book Title]    [⬇️ Tải xuống]
```
- Back button: Returns to previous page
- Title: Displays book name (truncated if long)
- Download button: Primary action

### Book Info Section
```
┌─────────────────────────────────────┐
│  [📚]    Title: Book Name           │
│         Author: Author Name          │
│         Description: ...             │
│         📅 Upload Date  📄 Pages    │
└─────────────────────────────────────┘
```

### Preview Notice
```
┌────────────────────────────────────┐
│ ℹ️  Xem trước sách                 │
│    Bạn đang xem bản xem trước...   │
└────────────────────────────────────┘
```

### PDF Viewer
```
┌────────────────────────────────────┐
│                                    │
│         PDF Content Here           │
│         (Embedded Viewer)          │
│                                    │
└────────────────────────────────────┘
```

### Download CTA Section
```
┌─────────────────────────────────────┐
│      Thích cuốn sách này?          │
│   Tải xuống để đọc toàn bộ...      │
│   [⬇️ Tải xuống sách]              │
└─────────────────────────────────────┘
```

---

## Technical Implementation

### State Management

```javascript
const [pdfUrl, setPdfUrl] = useState("");           // Preview URL
const [downloadUrl, setDownloadUrl] = useState(""); // Download URL (unused currently)
const [loading, setLoading] = useState(true);       // Page loading state
const [error, setError] = useState("");             // Error message
const [bookData, setBookData] = useState(null);     // Book metadata
const [isDownloading, setIsDownloading] = useState(false); // Download in progress
```

### API Calls

#### 1. Get Book Preview URL
```javascript
const result = await api.getReadUrl(bookId, { 
  responseContentDisposition: 'inline' 
});

// Response structure:
{
  url: "https://s3.signed.url...",
  title: "Book Title",
  author: "Author Name",
  description: "Description",
  uploadDate: "2025-01-15T10:30:00Z",
  pages: 250
}
```

**Purpose**: Fetch signed URL for inline PDF viewing  
**Endpoint**: `GET /books/read/{bookId}`  
**Query Params**: `responseContentDisposition=inline`

#### 2. Download Book
```javascript
const result = await api.getReadUrl(bookId, { 
  responseContentDisposition: 'attachment' 
});

// Creates download link programmatically
const link = document.createElement('a');
link.href = downloadUrl;
link.download = `${bookData?.title || 'book'}.pdf`;
link.click();
```

**Purpose**: Trigger file download to user's device  
**Endpoint**: `GET /books/read/{bookId}`  
**Query Params**: `responseContentDisposition=attachment`

### Error Handling

| Error Type | Status Code | Message | Action |
|------------|-------------|---------|--------|
| Book Not Found | 404 | "Sách không tồn tại hoặc chưa được duyệt" | Show error screen |
| Permission Denied | 403 | "Bạn không có quyền đọc sách này" | Show error screen |
| Network Error | - | "Không thể tải sách" | Show error screen |
| Download Failed | - | Alert with error message | Alert popup |

### Loading States

1. **Initial Load**
   - Spinner with "Đang tải sách..." message
   - Centered on screen

2. **Download in Progress**
   - Button shows spinner icon
   - Text changes to "Đang tải xuống..."
   - Button disabled to prevent multiple clicks

3. **Error State**
   - Sad emoji (😔)
   - Error message
   - "Quay lại" button to go back

---

## User Flows

### Happy Path: View and Download Book

1. User navigates to `/read/abc-123` from books list
2. Page loads, shows spinner
3. API call fetches signed URL and book metadata
4. Book info card displays with details
5. Preview notice appears
6. PDF loads in embedded viewer
7. User scrolls through preview
8. User clicks "Tải xuống" button
9. Download starts automatically
10. File saves to user's Downloads folder

### Error Flow: Book Not Found

1. User navigates to `/read/invalid-id`
2. Page loads, shows spinner
3. API returns 404 error
4. Error screen shows: "Sách không tồn tại hoặc chưa được duyệt"
5. User clicks "Quay lại" to return

### Error Flow: Download Failed

1. User on preview page
2. User clicks "Tải xuống"
3. API call fails (network error)
4. Alert shows: "Không thể tải xuống sách"
5. User can try again

---

## Security Considerations

### 1. **Authentication Required**
- Page should be wrapped in `ProtectedRoute` component (if not already)
- Only logged-in users can access

### 2. **Signed URLs**
- All S3 URLs are pre-signed with expiration
- URLs include authentication token
- Cannot be shared or reused after expiration

### 3. **Authorization**
- Backend validates user has permission to read book
- 403 error if user lacks access rights

### 4. **Content-Disposition Headers**
- `inline`: For preview (opens in browser)
- `attachment`: For download (saves to disk)
- Prevents unintended file execution

---

## Performance Optimizations

### 1. **Lazy Loading**
- PDF only loads after metadata fetched
- No unnecessary network requests

### 2. **Responsive Sizing**
- PDF viewer adapts to viewport
- Mobile: Aspect ratio 3:4
- Desktop: Fixed height 800px

### 3. **Error Recovery**
- Clear error messages guide user
- Back button always available
- No broken states

### 4. **Download Optimization**
- Direct S3 download (no proxy)
- Browser handles download progress
- Proper filename preservation

---

## Future Enhancements

### Potential Improvements:
1. **Limited Preview**: Show only first N pages instead of full book
2. **PDF.js Integration**: Better control over preview (page navigation, zoom)
3. **Read Progress**: Track which page user stopped reading
4. **Bookmarks**: Allow users to bookmark pages
5. **Annotations**: Let users highlight and take notes
6. **Multiple Formats**: Support ePub, MOBI, etc.
7. **Offline Mode**: Cache books for offline reading
8. **Reading Statistics**: Track reading time and completion
9. **Social Features**: Share quotes, reviews
10. **Text-to-Speech**: Audio playback for accessibility

### Pagination Preview:
```javascript
// Could implement page limit for preview
const previewUrl = await api.getReadUrl(bookId, { 
  responseContentDisposition: 'inline',
  pageLimit: 10 // Only show first 10 pages
});
```

---

## Styling Details

### Color Scheme
- **Primary**: Blue-600 (`#2563eb`)
- **Secondary**: Purple-600 (`#9333ea`)
- **Background Light**: Gray-100
- **Background Dark**: Gray-900
- **Card**: White / Gray-800 (dark mode)

### Gradients
- Book cover: `from-blue-500 to-purple-600`
- CTA section: `from-blue-600 to-purple-600`

### Icons
- 📚 Book emoji for cover placeholder
- 📅 Calendar for dates
- 📄 Document for page count
- ⬇️ Download arrow for buttons
- 😔 Sad face for errors
- ℹ️ Info icon for notices

### Responsive Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

---

## Testing Checklist

### Functional Tests
- [ ] Book loads correctly with valid ID
- [ ] Error shown for invalid book ID
- [ ] Error shown for unauthorized access
- [ ] Download button triggers file download
- [ ] Downloaded file has correct filename
- [ ] Back button navigates to previous page
- [ ] PDF viewer displays content properly

### UI Tests
- [ ] Book info card displays all metadata
- [ ] Preview notice is visible
- [ ] Loading spinner shows during load
- [ ] Download button shows loading state
- [ ] Error screen displays correctly
- [ ] Responsive on mobile devices
- [ ] Dark mode works properly

### Security Tests
- [ ] Unauthenticated users redirected to login
- [ ] Signed URLs expire correctly
- [ ] Cannot access other users' private books
- [ ] XSS protection in book titles/descriptions

### Performance Tests
- [ ] Page loads in < 2 seconds
- [ ] PDF renders without lag
- [ ] Download starts immediately
- [ ] No memory leaks on repeated views

---

## Related Components

- **Books List Page** (`pages/books.js`): Routes to this page
- **API Service** (`lib/api.js`): Provides `getReadUrl()` function
- **Protected Route** (`components/ProtectedRoute.js`): Handles auth
- **Auth Context** (`contexts/AuthContext.js`): User session management

---

## API Reference

### `api.getReadUrl(bookId, options)`

**Parameters:**
- `bookId` (string): UUID of the book
- `options` (object):
  - `responseContentDisposition` (string): 'inline' | 'attachment'

**Returns:**
```typescript
{
  url: string;          // Signed S3 URL
  readUrl?: string;     // Alternative key for URL
  title?: string;       // Book title
  author?: string;      // Author name
  description?: string; // Book description
  uploadDate?: string;  // ISO date string
  pages?: number;       // Page count
}
```

**Errors:**
- 404: Book not found or not approved
- 403: User lacks permission
- 500: Server error

---

## Maintenance Notes

### Dependencies
- Next.js Router for navigation
- Native browser PDF viewer (no external library)
- Standard DOM APIs for download functionality

### Browser Compatibility
- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support (may use iframe fallback)
- **Mobile browsers**: ✅ Responsive design

### Known Issues
None currently documented.

---

## Change Log

### Version 2.0 (December 2, 2025)
- ✨ Added book information card with metadata
- ✨ Added preview notice banner
- ✨ Added download functionality with two CTAs
- ✨ Improved UI with gradient cards and better spacing
- ✨ Added loading states for download
- ✨ Enhanced responsive design
- ✨ Added dark mode support throughout
- 🔧 Changed from full viewer to preview + download model

### Version 1.0 (Original)
- Basic PDF viewer with inline display
- Simple header with back button
- Minimal error handling
- Basic loading states

---

## Support

For issues or questions about the read page:
1. Check error messages in browser console
2. Verify API endpoints are working
3. Check S3 signed URL validity
4. Ensure user has proper permissions
5. Review backend logs for errors
