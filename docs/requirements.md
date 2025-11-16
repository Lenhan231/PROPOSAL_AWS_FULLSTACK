# Requirements Document - Thư Viện Online (Full-Stack)

## Introduction

Dự án này nhằm xây dựng hệ thống **Thư Viện Online** hoàn chỉnh - một nền tảng serverless trên AWS để lưu trữ và phân phối nội dung (PDF/ePub) cho nhóm nhỏ (~100 người dùng). Hệ thống ưu tiên bảo mật, quy trình duyệt nội dung (Admin Approval), và chi phí thấp (≈ $9.80/tháng).

**Kiến trúc**: 
- **Backend**: AWS Serverless (Cognito, API Gateway HTTP API, Lambda, DynamoDB, S3, CloudFront)
- **Frontend**: Next.js/React với AWS Amplify Hosting

**Lộ trình**: 6 tuần (Tuần 1-2: Nền tảng & Auth, Tuần 2-3: Upload & Approval, Tuần 3-4: Read & Search, Tuần 5-6: Security & Ops)

## Requirements

### Requirement 1: Hạ tầng cơ bản với CDK

**User Story:** Là một DevOps engineer, tôi muốn định nghĩa toàn bộ infrastructure bằng code, để có thể deploy và quản lý hệ thống một cách tự động và nhất quán.

#### Acceptance Criteria

1. WHEN khởi tạo project THEN developer SHALL sử dụng AWS CDK với Python
2. WHEN định nghĩa infrastructure THEN hệ thống SHALL có các stacks riêng biệt: CognitoStack, DatabaseStack, StorageStack, ApiStack, CdnStack, MonitoringStack
3. WHEN deploy THEN CDK SHALL tự động tạo CloudFormation templates và deploy lên AWS
4. WHEN cần rollback THEN developer SHALL có thể rollback về version trước thông qua CDK
5. WHEN deploy THEN hệ thống SHALL support multiple environments (dev, staging, prod)

### Requirement 2: Authentication với Cognito

**User Story:** Là một user, tôi muốn đăng ký và đăng nhập vào hệ thống, để có thể sử dụng các tính năng upload và đọc sách.

#### Acceptance Criteria

1. WHEN user đăng ký THEN Cognito SHALL tạo account và gửi email verification
2. WHEN user đăng nhập THEN Cognito SHALL trả về JWT tokens (access token, refresh token, ID token)
3. WHEN user là Admin THEN JWT SHALL chứa claim `cognito:groups: ["Admins"]`
4. WHEN access token hết hạn THEN user SHALL có thể dùng refresh token để lấy token mới
5. WHEN user quên mật khẩu THEN Cognito SHALL gửi email reset password
6. WHEN cấu hình User Pool THEN SHALL có password policy: min 8 chars, uppercase, lowercase, number, special char

### Requirement 3: API Gateway với JWT Authorizer

**User Story:** Là một developer, tôi muốn có API Gateway để route requests đến Lambda functions, để xây dựng RESTful API cho hệ thống.

#### Acceptance Criteria

1. WHEN tạo API Gateway THEN SHALL sử dụng HTTP API (không phải REST API) để tối ưu chi phí
2. WHEN request đến API THEN API Gateway SHALL validate JWT token từ Cognito
3. IF JWT không hợp lệ hoặc hết hạn THEN API Gateway SHALL trả về 401 Unauthorized
4. WHEN JWT hợp lệ THEN API Gateway SHALL forward request đến Lambda với user info trong context
5. WHEN cấu hình CORS THEN SHALL chỉ cho phép domain của frontend (Amplify)
6. WHEN cấu hình throttling THEN SHALL có rate limit: 1000 req/s burst, 500 req/s steady

### Requirement 4: DynamoDB cho metadata

**User Story:** Là một developer, tôi muốn lưu trữ metadata của sách trong database, để quản lý thông tin và trạng thái của từng sách.

#### Acceptance Criteria

1. WHEN thiết kế table THEN SHALL sử dụng single-table design với PK và SK
2. WHEN lưu book metadata THEN item SHALL chứa tối thiểu: bookId, title, author, description, uploaderId, uploaderEmail, status, fileSize, s3Key, uploadedAt; và SHALL support các field bổ sung: approvedAt, approvedBy, rejectedAt, rejectedReason, ttl (TTL cho cleanup)
3. WHEN tạo GSI THEN SHALL có: GSI1 (title-based), GSI2 (author-based), GSI3 (email lookup), GSI5 (status-based pending list), GSI6 (uploader-based my uploads); GSI4 được reserve cho future feature Shelves/Favorites
4. WHEN query THEN SHALL sử dụng Query operation (không dùng Scan)
5. WHEN update status THEN SHALL sử dụng conditional update để tránh race condition
6. WHEN billing THEN SHALL sử dụng On-Demand capacity mode
7. WHEN định nghĩa status THEN field `status` SHALL hỗ trợ các giá trị: `UPLOADING`, `PENDING`, `APPROVED`, `REJECTED`, `REJECTED_INVALID_TYPE`

### Requirement 5: S3 cho file storage

**User Story:** Là một system administrator, tôi muốn lưu trữ files PDF/ePub trong S3, để có storage scalable và cost-effective.

#### Acceptance Criteria

1. WHEN tạo bucket THEN SHALL có folder structure: `uploads/`, `public/books/`, `quarantine/`
2. WHEN cấu hình security THEN SHALL block all public access
3. WHEN cấu hình lifecycle THEN SHALL tự động xóa files trong `uploads/` sau 72 giờ
4. WHEN cấu hình event THEN SHALL trigger Lambda khi có file mới trong `uploads/`
5. WHEN CloudFront access THEN SHALL chỉ cho phép qua Origin Access Control (OAC)
6. WHEN versioning THEN SHALL enable versioning cho disaster recovery

### Requirement 6: Upload flow với Presigned URL

**User Story:** Là một user đã đăng nhập, tôi muốn upload file PDF/ePub, để chia sẻ tài liệu với cộng đồng.

#### Acceptance Criteria

1. WHEN user request upload THEN Lambda `createUploadUrl` SHALL tạo Presigned PUT URL với TTL 15 phút
2. WHEN tạo URL THEN Lambda SHALL validate file size ≤ 50MB và file extension (.pdf, .epub)
3. WHEN tạo URL THEN Lambda SHALL ghi Book Metadata vào DynamoDB với status `UPLOADING`, set `ttl` ≈ 72 giờ, lưu: bookId, title, author, description, uploaderId, uploaderEmail, s3Key, và set `GSI6PK=UPLOADER#userId`, `GSI6SK=BOOK#bookId` để user luôn thấy sách trong `my-uploads`
4. WHEN user upload THEN file SHALL được upload trực tiếp lên S3 (không qua Lambda)
5. WHEN upload complete THEN S3 Event SHALL trigger Lambda `validateMimeType`
6. WHEN validate THEN Lambda SHALL đọc magic bytes để verify MIME type
7. IF MIME type hợp lệ THEN Lambda SHALL update Book Metadata: set status `PENDING`, set `uploadedAt`, `fileSize`, `s3Key`, set `GSI5PK=STATUS#PENDING`, `GSI5SK=uploadedAt` và xóa field `ttl`
8. IF MIME type không hợp lệ THEN Lambda SHALL xóa file và update Book Metadata: set status `REJECTED_INVALID_TYPE`, set `uploadedAt`, đảm bảo `GSI6PK/GSI6SK` được set, và xóa field `ttl`
9. IF user không bao giờ upload file sau khi lấy Presigned URL THEN DynamoDB TTL SHALL tự động xóa Book Metadata ở trạng thái `UPLOADING` để tránh orphaned records

### Requirement 7: Admin approval flow

**User Story:** Là một Admin, tôi muốn duyệt hoặc từ chối files đã upload, để kiểm soát chất lượng nội dung.

#### Acceptance Criteria

1. WHEN Admin request pending list THEN Lambda `listPendingBooks` SHALL query DynamoDB và trả về books có status `PENDING`
2. IF user không phải Admin THEN Lambda SHALL check `cognito:groups` claim và trả về 403 Forbidden
3. WHEN Admin approve THEN Lambda `approveBook` SHALL copy file từ `uploads/` sang `public/books/`
4. WHEN copy success THEN Lambda SHALL update DynamoDB: status `APPROVED`, approvedAt, approvedBy và delete file từ `uploads/`
5. WHEN Admin reject THEN Lambda `rejectBook` SHALL delete file từ S3 và update status `REJECTED` với rejectedReason
6. WHEN reject THEN metadata SHALL được giữ lại trong DynamoDB để user biết lý do reject
7. WHEN approve/reject THEN Lambda SHALL ghi audit log vào DynamoDB (action, actorId, timestamp, reason)

### Requirement 8: Read flow với CloudFront Signed URL

**User Story:** Là một user đã đăng nhập, tôi muốn đọc sách đã được duyệt, để truy cập nội dung một cách an toàn và nhanh chóng.

#### Acceptance Criteria

1. WHEN user request read THEN Lambda `getReadUrl` SHALL kiểm tra book có status `APPROVED`
2. IF book chưa approved THEN Lambda SHALL trả về 403 Forbidden
3. WHEN book approved THEN Lambda SHALL tạo CloudFront Signed URL với TTL 1 giờ
4. WHEN user access Signed URL THEN CloudFront SHALL serve file từ S3 qua CDN
5. WHEN direct S3 access THEN S3 SHALL block request (chỉ cho phép CloudFront OAC)
6. WHEN Signed URL expired THEN user SHALL phải request URL mới

### Requirement 9: Search với DynamoDB GSI

**User Story:** Là một user, tôi muốn tìm kiếm sách theo title hoặc author, để nhanh chóng tìm thấy tài liệu cần thiết.

#### Acceptance Criteria

1. WHEN search by title THEN Lambda `searchBooks` SHALL query GSI1 với normalized title
2. WHEN search by author THEN Lambda SHALL query GSI2 với normalized author
3. WHEN search THEN request SHALL chỉ gửi **một** trong hai field `title` HOẶC `author` (mutually exclusive)
4. IF cả `title` và `author` cùng được gửi, HOẶC không field nào được gửi, THEN Lambda `searchBooks` SHALL trả về 400 Bad Request với mã lỗi `INVALID_REQUEST`
5. WHEN return results THEN SHALL chỉ trả về books có status `APPROVED`
6. WHEN normalize THEN SHALL lowercase và remove special characters
7. WHEN query THEN SHALL không sử dụng Scan operation

### Requirement 10: IAM roles với least privilege

**User Story:** Là một security engineer, tôi muốn mỗi Lambda có quyền tối thiểu cần thiết, để giảm thiểu rủi ro bảo mật.

#### Acceptance Criteria

1. WHEN tạo Lambda role THEN mỗi Lambda SHALL có IAM role riêng biệt
2. WHEN `createUploadUrl` THEN role SHALL có quyền: s3:PutObject (uploads/*), dynamodb:PutItem
3. WHEN `approveBook` THEN role SHALL có quyền: s3:GetObject, s3:PutObject, s3:DeleteObject, dynamodb:UpdateItem
4. WHEN `getReadUrl` THEN role SHALL có quyền: dynamodb:GetItem, cloudfront:CreateSignedUrl
5. WHEN `searchBooks` THEN role SHALL có quyền: dynamodb:Query (chỉ GSI)
6. WHEN `validateMimeType` THEN role SHALL có quyền: s3:GetObject, s3:DeleteObject, dynamodb:UpdateItem

### Requirement 11: Monitoring và logging

**User Story:** Là một DevOps engineer, tôi muốn giám sát hệ thống và xem logs, để phát hiện và xử lý sự cố kịp thời.

#### Acceptance Criteria

1. WHEN Lambda execute THEN logs SHALL được ghi vào CloudWatch Logs với retention 14 ngày
2. WHEN log THEN SHALL sử dụng structured logging (JSON format) với: requestId, userId, action, timestamp, status
3. WHEN error rate > 5% THEN CloudWatch Alarm SHALL gửi notification qua SNS
4. WHEN API 4xx > 10 in 5 min THEN CloudWatch Alarm SHALL alert
5. WHEN cost > $10/month THEN AWS Budget Alert SHALL notify
6. WHEN DynamoDB throttled THEN CloudWatch Alarm SHALL alert

### Requirement 12: User upload management

**User Story:** Là một user, tôi muốn xem danh sách sách tôi đã upload và trạng thái của chúng, để biết sách nào đã được duyệt, pending, hoặc bị reject.

#### Acceptance Criteria

1. WHEN user request my uploads THEN Lambda `getMyUploads` SHALL query DynamoDB theo uploaderId
2. WHEN return results THEN mỗi record SHALL bao gồm: bookId, title, author, description (optional), status, uploadedAt, và optional: approvedAt, rejectedAt, rejectedReason
3. WHEN return results THEN field `status` SHALL là một trong: `UPLOADING`, `PENDING`, `APPROVED`, `REJECTED`, `REJECTED_INVALID_TYPE`
4. WHEN status = `REJECTED` hoặc `REJECTED_INVALID_TYPE` THEN user SHALL thấy `rejectedReason` (nếu có) và `rejectedAt`
5. WHEN status = `APPROVED` THEN user SHALL thấy `approvedAt` và UI SHALL hiển thị action "Read"
6. WHEN status = `UPLOADING` THEN UI SHALL hiển thị trạng thái "Đang xử lý..." nhưng record vẫn xuất hiện trong danh sách `my-uploads`
7. WHEN sort THEN SHALL sắp xếp theo uploadedAt descending (mới nhất trước)

### Requirement 13: Security hardening

**User Story:** Là một security engineer, tôi muốn hệ thống có các cơ chế bảo mật, để ngăn chặn attacks và abuse.

#### Acceptance Criteria

1. WHEN validate file THEN SHALL check MIME type bằng magic bytes (không tin file extension)
2. WHEN S3 bucket THEN SHALL block all public access và chỉ cho phép CloudFront OAC
3. WHEN API Gateway THEN SHALL có rate limiting và throttling
4. WHEN input validation THEN SHALL sanitize user inputs (title, author, description)
5. WHEN CORS THEN SHALL chỉ allow frontend domain
6. WHEN file pending > 72h THEN SHALL tự động xóa qua S3 Lifecycle Policy
7. WHEN file rejected THEN SHALL xóa ngay khỏi S3 để tối ưu chi phí


### Requirement 13: Frontend với Amplify Hosting

**User Story:** Là một developer, tôi muốn deploy frontend lên AWS Amplify, để có CI/CD tự động và hosting cho React app.

#### Acceptance Criteria

1. WHEN cấu hình Amplify THEN SHALL kết nối với GitHub repository
2. WHEN push code THEN Amplify SHALL tự động build và deploy frontend
3. WHEN build THEN SHALL sử dụng Next.js build command
4. WHEN deploy THEN SHALL có custom domain với HTTPS
5. WHEN cấu hình THEN SHALL có environment variables cho API endpoint và Cognito config

### Requirement 14: Frontend Authentication UI

**User Story:** Là một user, tôi muốn có giao diện đăng ký/đăng nhập, để có thể truy cập hệ thống.

#### Acceptance Criteria

1. WHEN user truy cập /signup THEN SHALL hiển thị form đăng ký với email, password, name
2. WHEN user đăng ký THEN SHALL gọi Cognito API và hiển thị message "Check your email"
3. WHEN user truy cập /login THEN SHALL hiển thị form đăng nhập
4. WHEN user đăng nhập THEN SHALL lưu JWT tokens vào localStorage/cookies
5. WHEN user quên mật khẩu THEN SHALL có link "Forgot Password" và form reset
6. WHEN token hết hạn THEN SHALL tự động refresh token hoặc redirect về login

### Requirement 15: Frontend Upload UI

**User Story:** Là một user đã đăng nhập, tôi muốn có giao diện upload file, để dễ dàng tải sách lên hệ thống.

#### Acceptance Criteria

1. WHEN user truy cập /upload THEN SHALL hiển thị form với: file picker, title, author, description
2. WHEN user chọn file THEN SHALL validate file size ≤ 50MB và type (.pdf, .epub)
3. WHEN user submit THEN SHALL gọi API /books/upload-url để lấy Presigned URL
4. WHEN có Presigned URL THEN SHALL upload file trực tiếp lên S3 với progress bar
5. WHEN upload success THEN SHALL hiển thị success message và redirect về home
6. WHEN upload fail THEN SHALL hiển thị error message

### Requirement 16: Frontend Admin Dashboard

**User Story:** Là một Admin, tôi muốn có dashboard để quản lý sách pending, để dễ dàng duyệt/từ chối.

#### Acceptance Criteria

1. WHEN Admin truy cập /admin THEN SHALL hiển thị danh sách sách pending
2. WHEN hiển thị THEN mỗi sách SHALL có: title, author, uploader, uploadedAt, file size
3. WHEN Admin click "Approve" THEN SHALL gọi API /admin/books/{id}/approve
4. WHEN Admin click "Reject" THEN SHALL hiển thị modal nhập reason và gọi API reject
5. WHEN approve/reject success THEN SHALL refresh danh sách
6. IF user không phải Admin THEN SHALL redirect về home page

### Requirement 17: Frontend Book List và Search

**User Story:** Là một user, tôi muốn xem danh sách sách và tìm kiếm, để dễ dàng tìm tài liệu.

#### Acceptance Criteria

1. WHEN user truy cập home page THEN SHALL hiển thị danh sách sách đã approved
2. WHEN hiển thị THEN mỗi sách SHALL có: title, author, description, thumbnail (optional)
3. WHEN user chọn mode "Search by Title" và nhập query THEN frontend SHALL gọi API `/books/search?title=...&page=...&pageSize=...` với debounce 300ms
4. WHEN user chọn mode "Search by Author" và nhập query THEN frontend SHALL gọi API `/books/search?author=...&page=...&pageSize=...` với debounce 300ms
5. WHEN gọi API search THEN frontend SHALL đảm bảo chỉ gửi **một** trong hai query param `title` HOẶC `author` (không cả 2, không bỏ trống) để align với backend constraint
6. WHEN search results THEN SHALL hiển thị filtered list
7. WHEN user click vào sách THEN SHALL navigate đến `/books/{id}`

### Requirement 18: Frontend Book Reader

**User Story:** Là một user, tôi muốn đọc sách trong browser, để không cần download file.

#### Acceptance Criteria

1. WHEN user truy cập /books/{id} THEN SHALL gọi API /books/{id}/read-url để lấy Signed URL
2. WHEN có Signed URL THEN SHALL render PDF/ePub trong browser
3. WHEN render PDF THEN SHALL sử dụng react-pdf hoặc PDF.js
4. WHEN render ePub THEN SHALL sử dụng epub.js
5. WHEN Signed URL expired THEN SHALL tự động request URL mới
6. WHEN có lỗi THEN SHALL hiển thị error message và button "Try Again"

### Requirement 19: API Error Response DTO

**User Story:** Là một frontend developer, tôi muốn tất cả lỗi từ backend có format JSON thống nhất, để có thể xử lý và hiển thị thông báo lỗi cho người dùng một cách nhất quán.

#### Acceptance Criteria

1. WHEN bất kỳ backend API nào trả về lỗi 4xx hoặc 5xx THEN response body SHALL là JSON object theo cấu trúc:
   - `error`: string (thông điệp human-friendly, ví dụ "File size exceeds 50MB")
   - `code`: string (mã lỗi machine-readable, ví dụ "FILE_TOO_LARGE")
   - `requestId`: string (ID request/API Gateway requestId hoặc Lambda invocationId)
   - `timestamp`: string (ISO-8601, UTC)
2. WHEN set `code` THEN giá trị SHALL là một trong: `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `FILE_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`
3. WHEN xảy ra lỗi validate request (400 Bad Request) THEN backend SHALL dùng `code = "INVALID_REQUEST"`
4. WHEN JWT không hợp lệ hoặc hết hạn (401) THEN backend SHALL dùng `code = "UNAUTHORIZED"`
5. WHEN user không có quyền truy cập (403) THEN backend SHALL dùng `code = "FORBIDDEN"`
6. WHEN resource không tồn tại (404) THEN backend SHALL dùng `code = "NOT_FOUND"`
7. WHEN upload file vượt quá giới hạn hoặc sai MIME type THEN backend SHALL dùng `code = "FILE_TOO_LARGE"` hoặc `"UNSUPPORTED_MEDIA_TYPE"` tương ứng
