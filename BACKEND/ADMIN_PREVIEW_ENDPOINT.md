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


### Testing 
~ curl -i
-H "Authorization: Bearer eyJraWQiOiJkckxlQVZ2Qk9zQUxHODdDNVJTYjNhQlNWeGpmWFU1ZEJMVUY0TXFKR244PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiIwOTRhYTUzYy1jMGMxLTcwMWItOGZjOS0wMGEzYTM5ZmJlMjIiLCJjb2duaXRvOmdyb3VwcyI6WyJBZG1pbnMiXSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmFwLXNvdXRoZWFzdC0xLmFtYXpvbmF3cy5jb21cL2FwLXNvdXRoZWFzdC0xX1NLa29KcmFEMyIsImNsaWVudF9pZCI6IjdpamtlOTE0dnJ2ZG5xNjQ3MDZlbDh0bTdpIiwib3JpZ2luX2p0aSI6ImQwMjhkZjZkLTQ5YmQtNDA1ZC1hNmYyLTQ4MTdhNDBlZjM4MyIsImV2ZW50X2lkIjoiOTVlODBmNTUtYWExMy00YzMwLWEwNjAtMmRiMzQ1NTBkMWFmIiwidG9rZW5fdXNlIjoiYWNjZXNzIiwic2NvcGUiOiJhd3MuY29nbml0by5zaWduaW4udXNlci5hZG1pbiIsImF1dGhfdGltZSI6MTc2NDY3OTIwNSwiZXhwIjoxNzY0NjgyODA2LCJpYXQiOjE3NjQ2NzkyMDYsImp0aSI6IjA4ZTUyNmY2LTg0MTUtNDg2ZC1iYmI5LTlhZWFkODYzZjc4ZiIsInVzZXJuYW1lIjoiMDk0YWE1M2MtYzBjMS03MDFiLThmYzktMDBhM2EzOWZiZTIyIn0.ktfgda2JbqvViEdxtaVwbWDafPBvgc4FSCmUjkG28Ssp41Biue1lWVcaYZMdPff9xwDq9i1OsGHFrtzT_VTaTKMDyRXppLg0J75ua7lD8LAzzp1sshQLcaQ7XdwdLbydmvaZV90xGfDye7PhMWOtBa_F1vyoI1Q-riIfXUrK4G-VB9Y8Jj55InLaxIsxohTwJt3owb994LIz6BsTBOqCXiOxWXVygNSxVcF5k5jHUxmu_Al_iasyJW6pE8O0TG1xMPPazmgYHdWEF8AVb-Rh-6tqs-wXpqB-zc_IFHD6ZrK1dMjnuICMwtVFMBC7h6G7D1rk_8v7vAWbCpbMq9k8BA"
"https://bw4xxyd2yl.execute-api.ap-southeast-1.amazonaws.com/admin/books/90b5a1e4-3733-4bf9-a4e4-35b2f0607ccb/preview-url"
HTTP/2 200
date: Tue, 02 Dec 2025 12:40:59 GMT
content-type: text/plain; charset=utf-8
content-length: 282
apigw-requestid: U9euFi_ySQ0EPsw=

{"bookId": "90b5a1e4-3733-4bf9-a4e4-35b2f0607ccb", "url": "https://d38burzqr9feeu.cloudfront.net/staging/90b5a1e4-3733-4bf9-a4e4-35b2f0607ccb/lolita.pdf?response-content-disposition=inline%3B%20filename%3D%22lolita.pdf%22&response-content-type=application%2Fpdf", "expiresIn": 3600}%