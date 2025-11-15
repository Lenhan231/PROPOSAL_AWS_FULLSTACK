# Implementation Plan

## Phase 1: Môi trường và Kiến thức Nền tảng

- [ ] 1. Học kiến thức nền tảng Backend và AWS Serverless
  - Học về HTTP/REST API, Authentication/Authorization, Database basics
  - Học về AWS services: Lambda, API Gateway, DynamoDB, S3, Cognito, CloudFront, IAM
  - Học về Infrastructure as Code với AWS CDK
  - Đọc tài liệu: AWS Lambda Developer Guide, API Gateway Documentation
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Thiết lập môi trường phát triển
  - Cài đặt Node.js (v18+), Python (3.11+), AWS CLI, AWS CDK, Git
  - Tạo AWS Account và cấu hình billing alerts
  - Tạo IAM User với quyền Administrator (cho dev) và cấu hình AWS credentials (`aws configure`)
  - Verify cài đặt: `aws --version`, `cdk --version`, `python --version`
  - _Requirements: 2.1, 2.2_

- [ ] 3. Khởi tạo CDK project và deploy Hello World
  - Tạo CDK project: `cdk init app --language=typescript` hoặc `python`
  - Tạo cấu trúc thư mục: `lib/`, `lambda/`, `bin/`
  - Viết Lambda function "Hello World" đơn giản
  - Viết CDK stack để deploy Lambda
  - Deploy lên AWS: `cdk bootstrap`, `cdk deploy`
  - Test Lambda trên AWS Console
  - _Requirements: 2.3, 2.4_

## Phase 2: Authentication với Cognito

- [ ] 4. Tạo Cognito User Pool với CDK
  - Viết CDK stack `CognitoStack` để tạo User Pool
  - Cấu hình User Pool: email verification, password policy, MFA optional
  - Tạo User Pool Client (App Client) cho frontend
  - Tạo User Groups: `Users` (default) và `Admins`
  - Deploy stack và verify trên AWS Console
  - _Requirements: 3.1, 3.4_

- [ ] 5. Implement Auth Lambda functions
  - Tạo Lambda function `signup`: Tích hợp với Cognito SDK để đăng ký user
  - Tạo Lambda function `login`: Xác thực và trả về JWT tokens (access + refresh)
  - Tạo Lambda function `refreshToken`: Refresh access token khi hết hạn
  - Tạo Lambda function `forgotPassword`: Gửi email reset password
  - Implement error handling và validation cho tất cả auth functions
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [ ]* 5.1 Viết unit tests cho Auth Lambda functions
  - Test signup flow với valid/invalid inputs
  - Test login flow với correct/incorrect credentials
  - Test refresh token flow
  - Mock Cognito SDK với moto hoặc unittest.mock
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 6. Tạo API Gateway với JWT Authorizer
  - Viết CDK stack `ApiStack` để tạo HTTP API (không phải REST API)
  - Cấu hình JWT Authorizer với Cognito User Pool
  - Tạo routes cho auth endpoints: POST /auth/signup, /auth/login, /auth/refresh, /auth/forgot-password
  - Integrate Lambda functions với API Gateway routes
  - Cấu hình CORS cho frontend domain
  - Deploy và test với Postman/Thunder Client
  - _Requirements: 4.1, 4.2, 4.3_

## Phase 3: Database và Storage Setup

- [ ] 7. Thiết kế và tạo DynamoDB table
  - Thiết kế single-table schema với PK/SK pattern
  - Tạo CDK stack `DatabaseStack` với DynamoDB table
  - Cấu hình table: On-Demand billing, Point-in-time recovery
  - Tạo GSI1 cho title search: GSI1PK, GSI1SK
  - Tạo GSI2 cho author search: GSI2PK, GSI2SK
  - Deploy và verify table structure trên AWS Console
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 8. Tạo S3 buckets và cấu hình security
  - Viết CDK stack `StorageStack` để tạo S3 bucket
  - Tạo folder structure: `uploads/`, `public/books/`, `quarantine/`
  - Cấu hình Block Public Access (block all)
  - Cấu hình Lifecycle Policy: Xóa file trong `uploads/` sau 72 giờ
  - Cấu hình S3 Event Notifications cho `uploads/` folder
  - Cấu hình bucket versioning (optional)
  - _Requirements: 10.3, 10.6_

- [ ] 9. Implement IAM roles với least privilege
  - Tạo IAM role cho `createUploadUrl` Lambda: s3:PutObject (uploads/*), dynamodb:PutItem
  - Tạo IAM role cho `approveBook` Lambda: s3:GetObject, s3:PutObject, s3:DeleteObject, dynamodb:UpdateItem
  - Tạo IAM role cho `getReadUrl` Lambda: dynamodb:GetItem, cloudfront:CreateSignedUrl
  - Tạo IAM role cho `searchBooks` Lambda: dynamodb:Query
  - Tạo IAM role cho `validateFile` Lambda: s3:GetObject, s3:DeleteObject, dynamodb:UpdateItem
  - Verify permissions với IAM Policy Simulator
  - _Requirements: 4.4, 10.4_

## Phase 4: Upload Flow Implementation

- [ ] 10. Implement createUploadUrl Lambda function
  - Parse request body: fileName, fileSize, title, author, description
  - Validate file size (max 50MB) và file extension (.pdf, .epub)
  - Extract userId từ JWT claims trong event context
  - Generate unique bookId (UUID)
  - Create Presigned PUT URL với S3 SDK (TTL 15 phút)
  - Write metadata vào DynamoDB với status PENDING
  - Return response: uploadUrl, bookId, expiresIn
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [ ]* 10.1 Viết unit tests cho createUploadUrl
  - Test với valid inputs
  - Test với file size > 50MB (should reject)
  - Test với invalid file extension
  - Mock S3 và DynamoDB operations
  - _Requirements: 5.1, 5.5_

- [ ] 11. Implement validateFile Lambda function (S3 Event trigger)
  - Parse S3 Event để lấy bucket và object key
  - Download file header (first 4KB) từ S3
  - Validate MIME type bằng magic bytes (sử dụng thư viện `python-magic` hoặc `filetype`)
  - Nếu hợp lệ (PDF/ePub): Giữ nguyên file và status PENDING
  - Nếu không hợp lệ: Xóa file từ S3 và update DynamoDB status = REJECTED_INVALID_TYPE
  - Log kết quả validation vào CloudWatch
  - _Requirements: 5.6, 10.1, 10.2_

- [ ]* 11.1 Viết unit tests cho validateFile
  - Test với valid PDF file
  - Test với valid ePub file
  - Test với fake file (wrong MIME type)
  - Mock S3 operations
  - _Requirements: 10.1, 10.2_

- [ ] 12. Tạo API endpoint cho upload flow
  - Thêm route POST /books/upload-url vào API Gateway
  - Integrate với createUploadUrl Lambda
  - Cấu hình JWT Authorizer (require authentication)
  - Cấu hình rate limiting: 10 requests/minute per user
  - Deploy và test end-to-end upload flow
  - _Requirements: 4.1, 4.2, 4.3, 10.5_

## Phase 5: Admin Approval Flow

- [ ] 13. Implement listPendingBooks Lambda function
  - Query DynamoDB để lấy tất cả books với status = PENDING
  - Sử dụng Query operation với begins_with trên SK
  - Sort kết quả theo uploadedAt (descending)
  - Return danh sách books với metadata: bookId, title, author, uploader, uploadedAt, fileSize
  - _Requirements: 6.1_

- [ ] 14. Implement approveBook Lambda function
  - Extract bookId từ path parameters
  - Check admin permission: Verify `cognito:groups` claim chứa "Admins"
  - Nếu không phải admin: Return 403 Forbidden
  - Get book metadata từ DynamoDB
  - Copy file từ `uploads/{bookId}/` sang `public/books/{bookId}/` trong S3
  - Update DynamoDB: status = APPROVED, approvedAt, approvedBy
  - Write audit log vào DynamoDB (action: APPROVED)
  - Delete file từ `uploads/` folder
  - Return success response
  - _Requirements: 6.2, 6.3, 6.4, 6.6_

- [ ] 15. Implement rejectBook Lambda function
  - Extract bookId từ path parameters và reason từ request body
  - Check admin permission (same as approveBook)
  - Get book metadata từ DynamoDB
  - Delete file từ S3 `uploads/` folder
  - Update DynamoDB: status = REJECTED
  - Write audit log vào DynamoDB (action: REJECTED, reason)
  - Return success response
  - _Requirements: 6.2, 6.5, 6.6_

- [ ]* 15.1 Viết unit tests cho Admin functions
  - Test listPendingBooks với multiple books
  - Test approveBook với admin user
  - Test approveBook với non-admin user (should return 403)
  - Test rejectBook flow
  - Mock DynamoDB và S3 operations
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 16. Tạo API endpoints cho Admin flow
  - Thêm route GET /admin/books/pending
  - Thêm route POST /admin/books/{bookId}/approve
  - Thêm route POST /admin/books/{bookId}/reject
  - Integrate với Lambda functions
  - Cấu hình JWT Authorizer cho tất cả admin routes
  - Deploy và test với admin user và non-admin user
  - _Requirements: 4.2, 4.3, 6.2_

## Phase 6: Read Flow với CloudFront

- [ ] 17. Tạo CloudFront distribution với OAC
  - Viết CDK stack `CdnStack` để tạo CloudFront distribution
  - Cấu hình Origin: S3 bucket với Origin Access Control (OAC)
  - Cấu hình Behavior: Require signed URLs/cookies
  - Tạo CloudFront Key Pair cho signed URLs (hoặc dùng Trusted Key Groups)
  - Update S3 bucket policy: Chỉ cho phép CloudFront OAC access
  - Cấu hình cache behavior: Cache metadata API (3-5 min), không cache signed URLs
  - Deploy và verify CloudFront distribution
  - _Requirements: 7.4, 7.5, 10.3_

- [ ] 18. Implement getReadUrl Lambda function
  - Extract bookId từ path parameters
  - Extract userId từ JWT claims
  - Get book metadata từ DynamoDB
  - Check book status: Nếu không phải APPROVED, return 403 Forbidden
  - Generate CloudFront Signed URL với TTL 1 giờ
  - Log access request vào CloudWatch (userId, bookId, timestamp)
  - Return response: readUrl, expiresIn
  - _Requirements: 7.1, 7.2, 7.3, 7.6_

- [ ]* 18.1 Viết unit tests cho getReadUrl
  - Test với approved book
  - Test với pending book (should return 403)
  - Test với non-existent book (should return 404)
  - Mock DynamoDB và CloudFront SDK
  - _Requirements: 7.1, 7.2_

- [ ] 19. Tạo API endpoint cho read flow
  - Thêm route GET /books/{bookId}/read-url
  - Integrate với getReadUrl Lambda
  - Cấu hình JWT Authorizer
  - Deploy và test end-to-end read flow
  - Verify rằng direct S3 access bị chặn
  - _Requirements: 4.2, 4.3, 7.5_

## Phase 7: Search Implementation

- [ ] 20. Implement searchBooks Lambda function
  - Parse query parameters: title, author
  - Normalize search terms (lowercase, remove special chars)
  - Nếu có title: Query DynamoDB GSI1 với GSI1PK = TITLE#{normalizedTitle}
  - Nếu có author: Query DynamoDB GSI2 với GSI2PK = AUTHOR#{normalizedAuthor}
  - Filter kết quả: Chỉ trả về books với status = APPROVED
  - Nếu có cả title và author: Query cả 2 GSI và lấy intersection
  - Return danh sách books: bookId, title, author, description, uploadedAt
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ]* 20.1 Viết unit tests cho searchBooks
  - Test search by title only
  - Test search by author only
  - Test search by both title and author
  - Test với no results
  - Verify không sử dụng Scan operation
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 21. Tạo API endpoint cho search
  - Thêm route GET /books/search
  - Integrate với searchBooks Lambda
  - Cấu hình JWT Authorizer (optional: có thể cho phép public search)
  - Cấu hình caching: Cache search results 3-5 phút
  - Deploy và test với various search queries
  - _Requirements: 4.2, 4.3_

## Phase 8: Monitoring và Logging

- [ ] 22. Setup CloudWatch Logs và structured logging
  - Cấu hình log retention: 14 ngày cho tất cả Lambda functions
  - Implement structured logging trong Lambda functions (JSON format)
  - Log format: requestId, userId, action, timestamp, status, error details
  - Tạo Log Groups cho từng Lambda function
  - Test logging với CloudWatch Logs Insights queries
  - _Requirements: 11.1, 11.4, 11.5_

- [ ] 23. Setup CloudWatch Alarms
  - Viết CDK stack `MonitoringStack`
  - Tạo SNS Topic cho notifications
  - Tạo alarm: Lambda error rate > 5% (cho mỗi Lambda)
  - Tạo alarm: API Gateway 4xx errors > 10 in 5 minutes
  - Tạo alarm: API Gateway 5xx errors > 5 in 5 minutes
  - Tạo alarm: DynamoDB throttling > 0
  - Subscribe email đến SNS Topic
  - Deploy và test alarms (trigger intentional errors)
  - _Requirements: 11.2_

- [ ] 24. Setup AWS Budget Alerts
  - Tạo AWS Budget: Alert khi cost > $10/month
  - Tạo AWS Budget: Alert khi cost > $20/month (critical)
  - Cấu hình email notifications
  - Verify budget alerts trong AWS Billing Console
  - _Requirements: 11.3_

## Phase 9: Security Hardening

- [ ] 25. Implement rate limiting và throttling
  - Cấu hình API Gateway throttling: 1000 requests/second (burst), 500 requests/second (steady)
  - Cấu hình per-route throttling cho sensitive endpoints
  - Cấu hình usage plans và API keys (optional)
  - Test rate limiting với load testing tool (Artillery hoặc Locust)
  - _Requirements: 10.5_

- [ ] 26. Implement input validation và sanitization
  - Thêm validation cho tất cả Lambda inputs: file size, file type, string length
  - Sanitize user inputs: title, author, description (remove HTML tags, SQL injection attempts)
  - Implement request body validation schemas (JSON Schema hoặc Pydantic)
  - Add validation error responses với clear error messages
  - _Requirements: 10.1_

- [ ] 27. Security audit và penetration testing
  - Review IAM policies: Verify least privilege
  - Review S3 bucket policies: Verify no public access
  - Review API Gateway configuration: Verify JWT validation
  - Test common vulnerabilities: SQL injection, XSS, CSRF
  - Run AWS Trusted Advisor security checks
  - Document security findings và remediation
  - _Requirements: 10.3, 10.4_

## Phase 10: CI/CD và Deployment

- [ ] 28. Setup multi-environment configuration
  - Tạo CDK context cho environments: dev, staging, prod
  - Cấu hình environment-specific parameters: domain names, resource names
  - Implement environment variables cho Lambda functions
  - Create separate AWS accounts hoặc regions cho prod (optional)
  - _Requirements: 12.4_

- [ ] 29. Implement automated testing pipeline
  - Setup pytest cho unit tests
  - Setup integration tests với AWS SAM Local hoặc LocalStack
  - Create test fixtures và mock data
  - Implement test coverage reporting (aim for >80%)
  - Run tests locally: `pytest tests/ --cov`
  - _Requirements: 12.2_

- [ ] 30. Setup CI/CD với GitHub Actions
  - Tạo GitHub Actions workflow file: `.github/workflows/deploy.yml`
  - Configure workflow triggers: push to main, pull requests
  - Add steps: checkout, install dependencies, run tests, deploy CDK
  - Configure AWS credentials với GitHub Secrets
  - Implement deployment approval cho prod environment
  - Test CI/CD pipeline với dummy commit
  - _Requirements: 12.1, 12.2_

- [ ] 31. Implement rollback mechanism
  - Document CDK rollback procedure: `cdk deploy --rollback`
  - Implement CloudFormation stack versioning
  - Create rollback runbook: Steps to rollback each component
  - Test rollback procedure trong dev environment
  - Setup monitoring để detect failed deployments
  - _Requirements: 12.3, 12.5_

## Phase 11: Documentation và Final Testing

- [ ] 32. Viết API documentation
  - Document tất cả API endpoints: method, path, request/response format
  - Create Postman collection với example requests
  - Document authentication flow: signup, login, refresh token
  - Document error codes và error handling
  - Create API usage examples cho common scenarios
  - _Requirements: All_

- [ ] 33. End-to-end testing
  - Test complete upload flow: signup → login → upload → validate
  - Test complete approval flow: admin login → list pending → approve
  - Test complete read flow: login → search → get read URL → access content
  - Test error scenarios: invalid token, expired URL, unauthorized access
  - Test performance: concurrent uploads, search queries
  - Document test results và performance metrics
  - _Requirements: All_

- [ ] 34. Create deployment guide và runbook
  - Document prerequisites: AWS account, IAM permissions, tools
  - Document deployment steps: CDK bootstrap, deploy stacks
  - Document post-deployment verification steps
  - Create troubleshooting guide: Common issues và solutions
  - Document operational procedures: monitoring, backup, disaster recovery
  - _Requirements: 12.1, 12.4_

- [ ] 35. Cost optimization review
  - Review actual AWS costs vs estimates
  - Identify cost optimization opportunities: Lambda memory, DynamoDB capacity, CloudFront caching
  - Implement cost optimization recommendations
  - Setup cost monitoring dashboard
  - Document cost breakdown và optimization strategies
  - _Requirements: All_
