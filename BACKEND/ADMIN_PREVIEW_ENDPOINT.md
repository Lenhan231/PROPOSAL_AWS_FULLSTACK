# Admin Preview Endpoint

## Summary
Generate a short-lived CloudFront URL for admins to preview **pending** books before approval.

```
GET /admin/books/{bookId}/preview-url
Auth: JWT (admin)
Expires: 1h
```

> The path param is `bookId` (lowercase **d**). Make sure the API route wiring matches this.

## Query Parameters (optional)
- `response-content-disposition` — e.g. `inline; filename="draft.pdf"` (default: inline with the original filename).
- `response-content-type` — e.g. `application/pdf` (default: taken from metadata; falls back to `application/pdf` for .pdf files).

## Success Response (200)
```json
{
  "bookId": "abc-123",
  "url": "https://{cloudfront}/staging/abc-123/file.pdf?...",
  "expiresIn": 3600
}
```
- `url` is a CloudFront signed URL when key pair env vars are set; otherwise an unsigned CloudFront URL.
- Includes any response header overrides from the query parameters.

## Error Responses
- `400` — Missing `bookId` path parameter.
- `404` — Book not found or not in `PENDING` status.
- `500` — Misconfiguration (e.g., env vars missing) or invalid CloudFront private key.

## FE Usage
1. Call the endpoint with `Authorization: Bearer <admin-jwt>`.
2. Use `url` directly in an iframe (`<iframe src={url} />`) or open in a new tab.
3. Do not cache long-term; regenerate after `expiresIn` seconds if needed.
4. For forced download, pass `response-content-disposition=attachment; filename="..."`.

## Backend Expectations
- Environment: `BOOKS_TABLE_NAME`, `CLOUDFRONT_DOMAIN`, optional `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY` (base64 PEM).
- DynamoDB item must have `status = PENDING` and `file_path` set.
