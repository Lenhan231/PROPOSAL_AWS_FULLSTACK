# GetReadUrl Implementation Guide

## Overview

Integrated the book reading functionality that allows users to read approved books via CloudFront signed URLs.

## What Changed

### 1. API Client Configuration (`pages/_app.js`)

Connected the API client to AWS Amplify authentication:

```javascript
import { fetchAuthSession } from "aws-amplify/auth";
import { setTokenGetter } from "../lib/api";

// Set up token getter for API client
if (typeof window !== "undefined") {
  setTokenGetter(async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString();
    } catch {
      return null;
    }
  });
}
```

**What this does:**
- Automatically injects JWT ID token into all API requests
- The token is fetched fresh for each request
- No manual token management needed in pages

### 2. Books Page (`pages/books.js`)

#### Search Functionality
- Replaced mock data with real API calls to `api.searchBooks()`
- Added loading states and error handling
- Search by title or author
- Empty search shows all books

#### Book Reading
- Added "Đọc sách" button to each book card
- On click:
  1. Calls `api.getReadUrl(bookId)` with auto-injected JWT token
  2. Backend validates user auth and checks book status = APPROVED
  3. Returns CloudFront signed URL (valid for 1 hour)
  4. Opens URL in new tab to display PDF

#### Error Handling
- **403 Forbidden**: Book not approved or no permission
- **404 Not Found**: Book doesn't exist
- **Other errors**: Network issues, expired URLs, etc.

## API Endpoints Used

### GET `/books/search`

**Query params:**
- `q` (optional): Search query (searches in title, author, keywords)
- `limit` (default: 10): Maximum number of results

**Response:**
```json
{
  "books": [
    {
      "bookId": "uuid",
      "title": "Book Title",
      "author": "Author Name",
      "description": "Book description"
    }
  ]
}
```

### GET `/books/{bookId}/read-url`

**Headers:**
- `Authorization: Bearer <JWT_ID_TOKEN>` (auto-injected)

**Response:**
```json
{
  "url": "https://d123.cloudfront.net/public/books/uuid/book.pdf?Expires=...",
  "expiresIn": 3600
}
```

**Note:** The response uses `url` instead of `readUrl`. The frontend handles both formats for compatibility.

**Error responses:**
- `403`: Book not approved or user unauthorized
- `404`: Book not found
- `401`: Invalid/missing JWT token

## How It Works

### Authentication Flow

```
User visits /books
  ↓
Books page loads → useEffect calls api.searchBooks()
  ↓
api.searchBooks() → axios interceptor fetches JWT via setTokenGetter
  ↓
Request sent with Authorization header → API Gateway validates JWT
  ↓
Lambda returns approved books → Display in UI
```

### Reading Flow

```
User clicks "Đọc sách"
  ↓
BookCard calls api.getReadUrl(bookId)
  ↓
API client auto-adds JWT token (via interceptor)
  ↓
Backend Lambda:
  1. Validates JWT with Cognito
  2. Gets book from DynamoDB
  3. Checks status = APPROVED
  4. Creates CloudFront signed URL (TTL 1 hour)
  ↓
Returns { readUrl, expiresIn }
  ↓
Frontend opens URL in new tab → Browser displays PDF
```

## Security Features

1. **JWT Authentication**: All API requests require valid Cognito ID token
2. **Signed URLs**: CloudFront URLs are cryptographically signed
3. **Time-limited**: URLs expire after 1 hour
4. **Status Check**: Only APPROVED books can be read
5. **New Tab**: Opens in separate context for security

## UI Features

### Loading States
- Search button shows "Đang tìm..." while searching
- Read button shows spinner while fetching URL
- Form inputs disabled during loading

### Error Messages
- Friendly Vietnamese error messages
- Toast notifications for read errors
- Persistent error banner for search failures

### Empty States
- "Chưa có sách nào trong thư viện" - No books exist
- "Không tìm thấy sách phù hợp" - No search results

## Testing

### Local Testing

1. **Start dev server:**
   ```bash
   cd FRONTEND/plutonium-main
   npm run dev
   ```

2. **Login as user:**
   - Go to http://localhost:3000/login
   - Login with valid credentials

3. **Search books:**
   - Navigate to /books
   - Should load all approved books
   - Try searching by title or author

4. **Read a book:**
   - Click "Đọc sách" button
   - New tab should open with PDF
   - Check browser console for errors

### Error Testing

1. **Test 403 - Not Approved:**
   - Try reading a PENDING book (if visible)
   - Should show "Sách chưa được duyệt" error

2. **Test 401 - No Auth:**
   - Clear localStorage (logout)
   - Try reading a book
   - Should redirect to login

3. **Test 404 - Not Found:**
   - Manually call `api.getReadUrl('invalid-id')`
   - Should show "Không tìm thấy sách" error

## Backend Requirements

The backend Lambda (`getReadUrl`) must:

1. **Validate JWT token** with Cognito
2. **Get book metadata** from DynamoDB by bookId
3. **Check book.status === 'APPROVED'** (return 403 if not)
4. **Generate CloudFront signed URL**:
   - Private key from AWS Secrets Manager or SSM
   - Expiration time (e.g., 1 hour)
5. **Return JSON:**
   ```json
   {
     "readUrl": "https://...",
     "expiresIn": 3600
   }
   ```

## Known Limitations

1. **URL Expiration**: Users must open the PDF within 1 hour
2. **Single Tab**: Each click generates a new signed URL
3. **No Caching**: Signed URLs can't be cached due to expiration
4. **Backend Only**: Can't show books not yet in backend DynamoDB

## Next Steps

- [ ] Test with real backend data
- [ ] Add pagination controls (Next/Previous page)
- [ ] Add book cover images
- [ ] Add "Download" button (separate from "Read")
- [ ] Add reading history tracking
- [ ] Add bookmark functionality

## Troubleshooting

### "Không thể tải danh sách sách"
- Check backend API is running
- Check API_URL environment variable
- Check CloudWatch logs for Lambda errors

### "Sách chưa được duyệt"
- Book status must be APPROVED in DynamoDB
- Admin needs to approve via /admin/pending page

### "Không thể đọc sách"
- Check CloudFront distribution exists
- Check Lambda has permissions to sign URLs
- Check private key in Secrets Manager

### PDF doesn't open
- Check CloudFront signed URL is valid
- Check S3 bucket has the file
- Check browser pop-up blocker settings
- Check browser console for CORS errors

## Related Files

- `lib/api.js` - API client with getReadUrl method
- `lib/constants.js` - API endpoint definitions
- `pages/_app.js` - Token getter setup
- `pages/books.js` - Search and read UI
- `src/contexts/AuthContext.js` - Authentication context

## Environment Variables

Required in `.env.local` and Amplify Console:

```bash
NEXT_PUBLIC_API_URL=https://jjn2ygekea.execute-api.ap-southeast-1.amazonaws.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-southeast-1_SKkoJraD3
NEXT_PUBLIC_COGNITO_CLIENT_ID=7ijke914vrvdnq64706el8tm7i
NEXT_PUBLIC_COGNITO_REGION=ap-southeast-1
```
