# Frontend Design - Thư Viện Online

## Overview

Tài liệu này mô tả thiết kế high-level **frontend** cho hệ thống Thư Viện Online - giao diện web để người dùng tương tác với hệ thống.

### Design Goals

1. **User-friendly**: Giao diện đơn giản, dễ sử dụng
2. **Responsive**: Hoạt động tốt trên desktop, tablet, mobile
3. **Fast**: Tối ưu performance, lazy loading
4. **Secure**: JWT authentication, secure file handling
5. **Modern**: Sử dụng React/Next.js best practices

### Technology Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: AWS Amplify Auth (Cognito SDK)
- **HTTP Client**: Axios
- **PDF Viewer**: react-pdf
- **ePub Viewer**: epub.js
- **Hosting**: AWS Amplify Hosting
- **CI/CD**: Amplify CI/CD (GitHub integration)

## Architecture

### High-Level Architecture

```
User Browser
    ↓
Route 53 (DNS)
    ↓
Amplify Hosting (Next.js app)
    ↓
┌─────────────┬──────────────┐
│             │              │
Cognito    API Gateway   CloudFront
(Auth)     (Backend)     (Content)
```

## API Response Format

### Standard Response với Metadata

Tất cả list endpoints trả về format chuẩn với metadata:

```typescript
interface ApiResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}
```

**Example responses:**

```typescript
// GET /books/search?title=aws&page=1&pageSize=20
{
  "data": [
    {
      "bookId": "uuid",
      "title": "AWS Serverless Guide",
      "author": "John Doe",
      "description": "A comprehensive guide",
      "uploadedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "pageSize": 20,
    "hasMore": true
  }
}

// GET /books/my-uploads
{
  "data": [
    {
      "bookId": "uuid-0",
      "title": "My Upload In Progress",
      "author": "John Doe",
      "status": "UPLOADING",
      "uploadedAt": "2025-01-15T10:29:00Z"
    },
    {
      "bookId": "uuid-1",
      "title": "My Approved Book",
      "author": "John Doe",
      "status": "APPROVED",
      "uploadedAt": "2025-01-15T10:30:00Z",
      "approvedAt": "2025-01-15T11:00:00Z"
    },
    {
      "bookId": "uuid-2",
      "title": "My Pending Book",
      "author": "John Doe",
      "status": "PENDING",
      "uploadedAt": "2025-01-14T10:30:00Z"
    },
    {
      "bookId": "uuid-3",
      "title": "My Rejected Book",
      "author": "John Doe",
      "status": "REJECTED",
      "uploadedAt": "2025-01-13T10:30:00Z",
      "rejectedAt": "2025-01-13T11:00:00Z",
      "rejectedReason": "Copyright violation"
    },
    {
      "bookId": "uuid-4",
      "title": "Invalid File Type",
      "author": "John Doe",
      "status": "REJECTED_INVALID_TYPE",
      "uploadedAt": "2025-01-12T10:30:00Z"
    }
  ],
  "meta": {
    "total": 4,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

### TypeScript Types

```typescript
// types/api.ts

// Response Types
export interface Book {
  bookId: string;
  title: string;
  author: string;
  description?: string;
  uploadedAt: string;
}

export interface MyUpload extends Book {
  status: 'UPLOADING' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REJECTED_INVALID_TYPE';
  approvedAt?: string;        // Only when status = APPROVED
  rejectedAt?: string;        // Only when status = REJECTED
  rejectedReason?: string;    // Only when status = REJECTED
}

export interface PendingBook extends Book {
  uploader: string;
  fileSize: number;
}

export interface ApiMeta {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  data: T[];
  meta: ApiMeta;
}
```

## API Request DTOs

### Upload Request DTO

```typescript
// POST /books/upload-url
export interface CreateUploadUrlRequest {
  fileName: string;        // "book.pdf"
  fileSize: number;        // 5242880 (bytes)
  title: string;           // "AWS Serverless Guide"
  author: string;          // "John Doe"
  description?: string;    // "A comprehensive guide..."
}

export interface CreateUploadUrlResponse {
  uploadUrl: string;       // Presigned PUT URL
  bookId: string;          // "uuid"
  expiresIn: number;       // 900 (seconds)
}
```

### Search Request DTO

```typescript
// GET /books/search?title=aws&page=1&pageSize=20
// OR
// GET /books/search?author=john&page=1&pageSize=20
// NOTE: Chỉ search 1 field tại 1 thời điểm (title HOẶC author, không cả 2)
export interface SearchBooksRequest {
  title?: string;          // Search by title only
  author?: string;         // Search by author only
  page?: number;           // Default: 1
  pageSize?: number;       // Default: 20
}

export interface SearchBooksResponse {
  data: Book[];
  meta: ApiMeta;
}
```

**Search Limitation & UX**:
- Backend chỉ hỗ trợ search 1 field tại 1 thời điểm do DynamoDB GSI constraints.
- UI sẽ **ép buộc** người dùng chọn 1 mode ("by title" HOẶC "by author") và chỉ gửi **duy nhất 1** trong 2 field `title`/`author` lên backend. Nếu user cố nhập cả 2, FE sẽ chặn submit và hiển thị validation message thay vì để backend trả về 400.
- Nếu cần search kết hợp trong tương lai, cần dùng OpenSearch/ElasticSearch (future enhancement).

### Admin Approval DTOs

```typescript
// POST /admin/books/{bookId}/approve
export interface ApproveBookRequest {
  // No body needed, bookId in path
}

export interface ApproveBookResponse {
  bookId: string;
  status: 'APPROVED';
  message: string;
}

// POST /admin/books/{bookId}/reject
export interface RejectBookRequest {
  reason: string;          // "Copyright violation"
}

export interface RejectBookResponse {
  bookId: string;
  status: 'REJECTED';
  message: string;
}
```

### Read URL Request DTO

```typescript
// GET /books/{bookId}/read-url
export interface GetReadUrlRequest {
  // No body needed, bookId in path
}

export interface GetReadUrlResponse {
  readUrl: string;         // CloudFront Signed URL
  expiresIn: number;       // 3600 (seconds)
}
```

### My Uploads Request DTO

```typescript
// GET /books/my-uploads?page=1&pageSize=20
export interface GetMyUploadsRequest {
  page?: number;           // Default: 1
  pageSize?: number;       // Default: 20
}

export interface GetMyUploadsResponse {
  data: MyUpload[];
  meta: ApiMeta;
}
```

### Pending Books Request DTO

```typescript
// GET /admin/books/pending?page=1&pageSize=20
export interface GetPendingBooksRequest {
  page?: number;           // Default: 1
  pageSize?: number;       // Default: 20
}

export interface GetPendingBooksResponse {
  data: PendingBook[];
  meta: ApiMeta;
}
```

### Validation Rules

```typescript
// Validation constraints
export const ValidationRules = {
  fileName: {
    maxLength: 255,
    allowedExtensions: ['.pdf', '.epub']
  },
  fileSize: {
    max: 50 * 1024 * 1024,  // 50MB
    min: 1024                // 1KB
  },
  title: {
    minLength: 1,
    maxLength: 200
  },
  author: {
    minLength: 1,
    maxLength: 100
  },
  description: {
    maxLength: 1000
  },
  rejectReason: {
    minLength: 10,
    maxLength: 500
  }
};
```

### Error Response DTO

```typescript
export interface ApiError {
  error: string;           // "File size exceeds 50MB"
  code: string;            // "FILE_TOO_LARGE"
  requestId: string;       // "uuid"
  timestamp: string;       // "2025-01-15T10:30:00Z"
}

export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';
```

## Page Structure

```
app/
├── layout.tsx                    # Root layout (navbar, footer)
├── page.tsx                      # Home page
├── login/
│   └── page.tsx                  # Login page
├── signup/
│   └── page.tsx                  # Signup page
├── books/
│   ├── page.tsx                  # Browse all books
│   └── [bookId]/
│       ├── page.tsx              # Book detail
│       └── read/
│           └── page.tsx          # Book reader
├── upload/
│   └── page.tsx                  # Upload page
├── my-uploads/
│   └── page.tsx                  # My uploads page
└── admin/
    ├── layout.tsx                # Admin layout (admin navbar)
    ├── dashboard/
    │   └── page.tsx              # Admin dashboard
    └── pending/
        └── page.tsx              # Pending books page
```

## Key Features

### 1. Authentication

**Pages:**
- Login page (email/password)
- Signup page (email/password + confirmation)
- Forgot password page
- Email verification flow

**Features:**
- JWT token storage (localStorage)
- Auto-refresh token
- Protected routes (redirect to login if not authenticated)
- Admin routes (redirect if not admin)

### 2. Book Browsing & Search

**Pages:**
- Home page: Featured books, recent uploads
- Browse page: All approved books with pagination
- Search page: Search by title/author

**Features:**
- Book cards with title, author, description
- Search bar với **mode selector**:
  - Dropdown / toggle: "Search by Title" HOẶC "Search by Author"
  - Chỉ enable **một** ô input tại một thời điểm để đảm bảo chỉ gửi 1 field cho backend
- Pagination or infinite scroll
- Book detail page with metadata

### 3. Book Reading

**Pages:**
- Book reader page (full-screen)

**Features:**
- PDF viewer (react-pdf)
- ePub viewer (epub.js)
- Page navigation (previous/next)
- Zoom in/out
- Fullscreen mode
- Bookmark (optional)

**Flow:**
1. User clicks "Read" button
2. Frontend calls API: `GET /books/{bookId}/read-url`
3. Backend returns CloudFront Signed URL (TTL 1 hour)
4. Frontend loads PDF/ePub from Signed URL

### 4. Book Upload

**Pages:**
- Upload page (form)

**Features:**
- File picker (accept .pdf, .epub only)
- File size validation (max 50MB)
- Form fields: title, author, description
- Upload progress bar
- Success/error messages

**Flow:**
1. User selects file and fills form
2. Frontend calls API: `POST /books/upload-url`
3. Backend returns Presigned PUT URL
4. Frontend uploads file directly to S3 (not through backend)
5. Show success message

### 5. My Uploads

**Pages:**
- My uploads page (list of user's uploads)

**Features:**
- List of books uploaded by current user
- Status badges:
  - UPLOADING (gray/blue) – file đang được xử lý (chưa qua validateMimeType)
  - PENDING (yellow) – chờ admin duyệt
  - APPROVED (green) – đã duyệt, có thể đọc
  - REJECTED / REJECTED_INVALID_TYPE (red) – bị từ chối
- Show rejection reason if rejected
- Link to read if approved

**Flow:**
1. Frontend calls API: `GET /books/my-uploads`
2. Display list với status:
   - Nếu `status=UPLOADING`: hiển thị label "Đang xử lý..." và có thể gợi ý user reload sau vài giây nếu chưa thấy chuyển sang PENDING
   - Các status khác hiển thị như bình thường

### 6. Admin Panel

**Pages:**
- Admin dashboard (statistics)
- Pending books page (list + actions)

**Features:**
- List of pending books
- Book metadata: title, author, uploader, file size, upload date
- Approve button (green)
- Reject button (red) with reason input
- Statistics: total books, pending, approved, rejected

**Flow (Approve):**
1. Admin clicks "Approve"
2. Frontend calls API: `POST /admin/books/{bookId}/approve`
3. Refresh list

**Flow (Reject):**
1. Admin clicks "Reject"
2. Show modal/prompt for rejection reason
3. Frontend calls API: `POST /admin/books/{bookId}/reject` with reason
4. Refresh list

## API Integration

### Authentication APIs

- `POST /auth/signup` - Signup (Cognito)
- `POST /auth/login` - Login (Cognito)
- `POST /auth/refresh` - Refresh token (Cognito)
- `POST /auth/forgot-password` - Forgot password (Cognito)

### Book APIs

- `GET /books/search?title=...` OR `GET /books/search?author=...` - Search books (1 field only)
- `POST /books/upload-url` - Get Presigned PUT URL
- `GET /books/{bookId}/read-url` - Get CloudFront Signed URL
- `GET /books/my-uploads` - Get user's uploads

### Admin APIs

- `GET /admin/books/pending` - Get pending books
- `POST /admin/books/{bookId}/approve` - Approve book
- `POST /admin/books/{bookId}/reject` - Reject book

**Note**: Tất cả APIs (trừ auth) đều cần JWT token trong header: `Authorization: Bearer <token>`

## State Management

### Auth State

- Current user info (email, userId, groups)
- isAuthenticated flag
- isAdmin flag
- Login/logout functions

## State Management Strategy

### Architecture Overview

**Combo: TanStack Query + Zustand + React Context**

```
┌─────────────────────────────────────────────────────┐
│                  React Application                   │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────┐      ┌──────────────────┐    │
│  │  TanStack Query  │      │     Zustand      │    │
│  │  (Server State)  │      │  (Client State)  │    │
│  └──────────────────┘      └──────────────────┘    │
│           │                          │              │
│  • Books list              • Theme                  │
│  • Pending list            • Modal state            │
│  • My uploads              • Filter text            │
│  • Read/Upload URLs        • Sidebar                │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │         React Context (Auth Only)            │  │
│  │  • User info  • isAdmin  • signIn/signOut    │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 1. TanStack Query - Server State

**Manages**: All data from backend API

**Features**:

- Auto caching (no redundant API calls)
- Auto refetch (data always fresh)
- Loading/error states per query
- Optimistic updates
- Query invalidation (approve/reject → refetch pending list)

**Query Keys**:
- `['books', { title, author }]` - Search results
- `['admin', 'pending']` - Pending books
- `['books', 'my-uploads']` - User uploads
- `['books', bookId, 'read-url']` - Read URL

### 2. Zustand - Client/UI State

**Manages**: UI state only

**Data**:
- Theme (light/dark)
- Modal state (open/close, type, bookId)
- Sidebar (open/close)
- Filter text (before submit)
- Toast notifications

**Benefits**:
- Lightweight (< 1KB)
- No boilerplate
- TypeScript support
- No Provider needed

### 3. React Context - Auth State

**Manages**: Authentication only

**Data**:
- User info from JWT
- isAdmin flag
- signIn/signOut methods

**Why Context?**: Auth state is global but doesn't change often

### State Flow Example

**Admin approves book**:
1. Click "Approve" → Zustand opens modal
2. Confirm → TanStack Query mutation
3. API success → Invalidate `['admin', 'pending']`
4. TanStack Query auto refetches
5. UI updates → Zustand closes modal

## UI/UX Design

### Color Scheme

- Primary: Blue (#3B82F6)
- Success: Green (#10B981)
- Warning: Yellow (#F59E0B)
- Danger: Red (#EF4444)
- Neutral: Gray (#6B7280)

### Components

- **Navbar**: Logo, Search (input + dropdown "Title/Author"), Upload, My Uploads, Admin (if admin), Logout
- **Footer**: Copyright, Links
- **BookCard**: Thumbnail, Title, Author, Description, Read button
- **StatusBadge**: PENDING (yellow), APPROVED (green), REJECTED (red)
- **Modal**: Confirmation dialogs, Rejection reason input
- **Toast**: Success/error notifications

### Responsive Design

- Desktop: 3-column grid for book cards
- Tablet: 2-column grid
- Mobile: 1-column grid, hamburger menu

## Security

### Client-Side Security

- Store JWT token in localStorage (or httpOnly cookie for better security)
- Validate token expiration before API calls
- Auto-refresh token when expired
- Clear token on logout
- Sanitize user inputs (XSS prevention)

### Protected Routes

- `/upload` - Require authentication
- `/my-uploads` - Require authentication
- `/books/{bookId}/read` - Require authentication
- `/admin/*` - Require admin role

## Performance Optimization

### Code Splitting

- Lazy load PDF/ePub viewer components
- Route-based code splitting (Next.js automatic)

### Caching

- Cache API responses (React Query / SWR)
- Cache static assets (Next.js automatic)

### Image Optimization

- Use Next.js Image component
- Lazy load images

## Deployment

### Amplify Hosting

**Configuration:**
- Connect GitHub repository
- Auto-deploy on push to main branch
- Environment variables: API_URL, USER_POOL_ID, CLIENT_ID

**Build Settings:**
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm install
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
```

### Environment Variables

```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_USER_POOL_ID=ap-southeast-1_xxxxx
NEXT_PUBLIC_CLIENT_ID=xxxxxxxxxxxxx
```

## Testing Strategy

### Unit Tests

- Test React components (Jest + React Testing Library)
- Test utility functions
- Test API client functions

### Integration Tests

- Test user flows (login → upload → view)
- Test admin flows (login → approve/reject)

### E2E Tests

- Test critical paths with Cypress
- Test on multiple browsers

## Accessibility

- Semantic HTML elements
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader support
- Color contrast compliance (WCAG AA)

## Future Enhancements

- Dark mode
- Bookmarks/favorites (cần backend API cho Shelves; backend đã chuẩn bị data model nhưng **không deploy trong MVP**)
- Reading progress tracking
- Comments/reviews
- Categories/tags
- Advanced search filters
- Notifications (email/push)
