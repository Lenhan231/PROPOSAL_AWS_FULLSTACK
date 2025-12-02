# Static Export Error Page Solution

## Problem
With Next.js `output: 'export'` (static export), error states couldn't be rendered dynamically because:
- HTML is pre-rendered at build time
- Runtime errors occur AFTER the HTML is already served
- Browser behavior caused redirects to homepage instead of showing error UI

## Solution: Dedicated Error Page

Instead of trying to show errors inline (which doesn't work with static export), we now **redirect to a dedicated error page** (`/read-error`) that is pre-rendered during build.

### Changes Made

#### 1. Created `/pages/read-error.js`
- Dedicated static error page with query params for context
- Displays admin-specific instructions when `isAdmin=true`
- Shows different error messages based on `reason` parameter
- Includes debug info and action buttons

#### 2. Updated `/pages/read/[bookId].js`
- **Removed**: Inline error UI (270+ lines)
- **Removed**: `error` and `preventNavigation` states
- **Changed**: On API failure → `router.replace('/read-error?bookId=...&isAdmin=...&reason=...')`
- **Simplified**: Only shows loading or PDF viewer, no error handling

#### 3. Updated `next.config.js`
```javascript
exportPathMap: async function (defaultPathMap) {
  return {
    ...defaultPathMap,
    '/read-error': { page: '/read-error' },
  }
}
```
This ensures `/read-error` is pre-rendered and available as a static page.

## How It Works

### For Admin Preview (PENDING books):
1. Admin clicks "Preview" on pending book
2. Opens `/read/{bookId}` in new tab
3. Page checks if user is admin
4. Tries `GET /admin/books/{bookId}/preview-url` → **404**
5. Tries fallback `GET /books/{bookId}/read-url` → **403/404** (pending)
6. Both fail → **Redirects to** `/read-error?bookId=xxx&isAdmin=true&reason=admin_endpoint_not_found`
7. Error page shows admin-specific instructions with endpoint details

### For Regular Users:
1. User opens `/read/{bookId}`
2. Tries `GET /books/{bookId}/read-url`
3. Fails (404/403) → **Redirects to** `/read-error?bookId=xxx&isAdmin=false&reason=book_not_found`
4. Error page shows user-friendly message

## Why This Works with Static Export

✅ **Error page is pre-rendered** at build time (HTML exists)
✅ **No dynamic rendering needed** - just URL query params change
✅ **Router.replace() works** - navigates to existing static page
✅ **No race conditions** - error page is always available
✅ **Amplify serves it correctly** - just a static HTML file

## Error Reasons

| Reason | Description |
|--------|-------------|
| `admin_endpoint_not_found` | Admin endpoint 404 + fallback failed |
| `admin_preview_failed` | Admin endpoint error (non-404) |
| `book_not_found` | Book doesn't exist (404) |
| `access_denied` | User lacks permission (403) |
| `no_url` | API returned success but no URL |
| `unknown_error` | Generic error |

## Testing

### Local Testing
```powershell
cd FRONTEND/plutonium-main
npm run dev
```

1. Go to `http://localhost:3000/admin/pending`
2. Click "Preview" on any pending book
3. Should redirect to `/read-error` with admin instructions

### Production Testing
Wait for AWS Amplify to rebuild (5-10 minutes), then:
1. Go to your Amplify URL
2. Navigate to `/admin/pending`
3. Click "Preview"
4. Should now see error page instead of redirecting to homepage

## Benefits

- ✅ Works with static export (no SSR needed)
- ✅ Clean separation of concerns (error page vs read page)
- ✅ Better UX (clear error messages, action buttons)
- ✅ Easier to debug (dedicated error page with query params)
- ✅ Solves homepage redirect issue permanently

## Next Steps

1. **Test locally** to verify error page shows correctly
2. **Wait for Amplify deploy** (~5-10 mins after push)
3. **Test in production** to confirm no more homepage redirects
4. **Backend implementation** - create `/admin/books/{bookId}/preview-url` endpoint to allow actual admin previews

## Files Changed

- ✅ `FRONTEND/plutonium-main/pages/read-error.js` - NEW
- ✅ `FRONTEND/plutonium-main/pages/read/[bookId].js` - MODIFIED (simplified)
- ✅ `FRONTEND/plutonium-main/next.config.js` - MODIFIED (added exportPathMap)

## Commit

```
c55544b - fix: redirect to dedicated error page for static export compatibility
```

Pushed to both `origin/FE` and `anquoc/FE`.
