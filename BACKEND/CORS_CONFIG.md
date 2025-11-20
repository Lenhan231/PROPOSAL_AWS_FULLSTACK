# CORS Configuration Guide

## Overview
CORS (Cross-Origin Resource Sharing) cho phép browser upload file trực tiếp lên S3 từ frontend.

## Configuration

### 1. Default Configuration (cdk.context.json)
File `cdk.context.json` chứa CORS origins cho mỗi environment:

```json
{
  "dev": {
    "cors_origins": "http://localhost:3000,http://localhost:3001"
  },
  "staging": {
    "cors_origins": "https://staging.example.com"
  },
  "prod": {
    "cors_origins": "https://example.com"
  }
}
```

### 2. Deploy Commands

#### Development (localhost)
```bash
cd BACKEND
cdk deploy -c env=dev
```

#### Staging (Amplify)
```bash
cd BACKEND
cdk deploy -c env=staging -c cors_origins="https://staging.example.com"
```

#### Production
```bash
cd BACKEND
cdk deploy -c env=prod -c cors_origins="https://example.com"
```

### 3. Override via CLI
Bạn có thể override CORS origins khi deploy:

```bash
cdk deploy -c cors_origins="https://custom.example.com,https://another.example.com"
```

## How It Works

1. **Lambda generates presigned URL** → Giải quyết authentication (không cần AWS credentials)
2. **Browser sends OPTIONS request** → Browser hỏi S3: "Có được phép PUT không?"
3. **S3 returns CORS headers** → Nếu origin match → Browser cho phép request
4. **Browser sends PUT request** → Upload file trực tiếp lên S3

## CORS Headers Configured

```
Allowed Methods: GET, PUT, POST
Allowed Headers: * (all)
Exposed Headers: ETag, x-amz-version-id
Max Age: 3600 seconds (1 hour)
```

## Troubleshooting

### Error: "No 'Access-Control-Allow-Origin' header"
- Kiểm tra frontend URL có match với CORS origins không
- Ví dụ: Nếu frontend ở `https://app.example.com` nhưng CORS chỉ cho `https://example.com` → Sẽ bị block

### Error: "Method not allowed"
- Kiểm tra S3 CORS config có cho phép PUT method không

### Solution
Cập nhật `cdk.context.json` hoặc deploy lại với đúng CORS origins:

```bash
cdk deploy -c cors_origins="https://app.example.com"
```

## For Amplify Deployment

Khi deploy lên Amplify:

1. Lấy Amplify domain (ví dụ: `https://main.d123456.amplifyapp.com`)
2. Deploy backend với CORS origin đó:
   ```bash
   cdk deploy -c env=staging -c cors_origins="https://main.d123456.amplifyapp.com"
   ```
3. Frontend sẽ có thể upload file trực tiếp lên S3

## Security Notes

- CORS chỉ là client-side security (browser enforcement)
- Presigned URL vẫn là server-side security (AWS authentication)
- Kết hợp cả hai = Secure direct upload
- Không nên để CORS origins quá rộng (ví dụ: `*`)
