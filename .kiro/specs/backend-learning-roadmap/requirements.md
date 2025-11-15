# Requirements Document

## Introduction

Dự án này nhằm tạo ra một lộ trình học tập và xây dựng backend hoàn chỉnh cho hệ thống Thư Viện Online - một nền tảng serverless trên AWS. Lộ trình được thiết kế cho người học từ đầu, bao gồm cả kiến thức nền tảng và triển khai thực tế theo kiến trúc serverless với các dịch vụ AWS (Lambda, API Gateway, DynamoDB, S3, Cognito, CloudFront).

Mục tiêu là xây dựng một hệ thống backend có khả năng:
- Xác thực và phân quyền người dùng (User/Admin)
- Quản lý upload file PDF/ePub với quy trình duyệt
- Phân phối nội dung an toàn qua CDN với Signed URL
- Tìm kiếm sách theo tiêu đề và tác giả
- Giám sát và bảo mật hệ thống

## Requirements

### Requirement 1: Kiến thức nền tảng Backend

**User Story:** Là một developer mới, tôi muốn nắm vững các kiến thức nền tảng về backend development, để có thể hiểu và xây dựng hệ thống serverless một cách hiệu quả.

#### Acceptance Criteria

1. WHEN học về backend development THEN hệ thống học tập SHALL bao gồm các khái niệm: HTTP/REST API, Authentication/Authorization, Database, File Storage, CDN
2. WHEN học về AWS Serverless THEN hệ thống học tập SHALL bao gồm: Lambda, API Gateway, DynamoDB, S3, Cognito, CloudFront, IAM
3. WHEN học về Infrastructure as Code THEN hệ thống học tập SHALL bao gồm AWS CDK với Python hoặc TypeScript
4. WHEN hoàn thành phần nền tảng THEN developer SHALL có khả năng giải thích được kiến trúc serverless và các dịch vụ AWS cơ bản

### Requirement 2: Thiết lập môi trường phát triển

**User Story:** Là một developer, tôi muốn thiết lập môi trường phát triển đầy đủ, để có thể bắt đầu code và deploy lên AWS.

#### Acceptance Criteria

1. WHEN thiết lập môi trường THEN developer SHALL cài đặt: Node.js/Python, AWS CLI, AWS CDK, Git
2. WHEN cấu hình AWS THEN developer SHALL tạo AWS Account, cấu hình IAM User với quyền phù hợp, và cấu hình AWS credentials
3. WHEN khởi tạo project THEN developer SHALL tạo được CDK project với cấu trúc thư mục chuẩn
4. WHEN test môi trường THEN developer SHALL deploy được một Lambda "Hello World" thành công

### Requirement 3: Xây dựng hệ thống Authentication

**User Story:** Là một user, tôi muốn đăng ký và đăng nhập vào hệ thống, để có thể sử dụng các tính năng của thư viện.

#### Acceptance Criteria

1. WHEN user đăng ký THEN hệ thống SHALL tạo tài khoản trong Cognito User Pool và gửi email xác thực
2. WHEN user đăng nhập THEN hệ thống SHALL xác thực thông tin và trả về JWT token (access token, refresh token)
3. WHEN user quên mật khẩu THEN hệ thống SHALL gửi email reset password
4. IF user là Admin THEN JWT token SHALL chứa claim `cognito:groups: ["Admins"]`
5. WHEN token hết hạn THEN user SHALL có thể refresh token để lấy token mới

### Requirement 4: Xây dựng API Gateway và Lambda Functions

**User Story:** Là một developer, tôi muốn xây dựng các API endpoints với Lambda, để xử lý các nghiệp vụ của hệ thống.

#### Acceptance Criteria

1. WHEN tạo API Gateway THEN hệ thống SHALL sử dụng HTTP API (không phải REST API) để tối ưu chi phí
2. WHEN request đến API THEN API Gateway SHALL xác thực JWT token từ Cognito
3. WHEN xác thực thành công THEN request SHALL được route đến Lambda function tương ứng
4. WHEN Lambda xử lý THEN Lambda SHALL có quyền IAM tối thiểu cần thiết (least privilege)
5. WHEN có lỗi THEN Lambda SHALL trả về error response với status code và message phù hợp

### Requirement 5: Xây dựng hệ thống Upload File

**User Story:** Là một user đã đăng nhập, tôi muốn upload file PDF/ePub lên hệ thống, để chia sẻ tài liệu với cộng đồng.

#### Acceptance Criteria

1. WHEN user request upload THEN Lambda SHALL tạo Presigned PUT URL trỏ đến S3 bucket `uploads/`
2. WHEN tạo Presigned URL THEN URL SHALL có thời gian hết hạn (TTL) là 15 phút
3. WHEN user upload file THEN file SHALL được upload trực tiếp lên S3 qua Presigned URL (không qua Lambda)
4. WHEN upload thành công THEN Lambda SHALL ghi metadata vào DynamoDB với status `PENDING`
5. IF file size > 50MB THEN hệ thống SHALL reject request
6. WHEN file được upload THEN S3 Event SHALL trigger Lambda để validate MIME type

### Requirement 6: Xây dựng quy trình Admin Approval

**User Story:** Là một Admin, tôi muốn xem danh sách file pending và duyệt/từ chối, để kiểm soát chất lượng nội dung.

#### Acceptance Criteria

1. WHEN Admin request danh sách pending THEN Lambda SHALL query DynamoDB và trả về các file có status `PENDING`
2. IF user không phải Admin THEN hệ thống SHALL trả về `403 Forbidden`
3. WHEN Admin approve file THEN Lambda SHALL copy file từ `uploads/` sang `public/books/` trong S3
4. WHEN copy thành công THEN Lambda SHALL cập nhật status trong DynamoDB thành `APPROVED`
5. WHEN Admin reject file THEN Lambda SHALL cập nhật status thành `REJECTED` và xóa file khỏi S3
6. WHEN approve/reject THEN hệ thống SHALL ghi audit log (adminID, timestamp, action)

### Requirement 7: Xây dựng hệ thống đọc sách với Signed URL

**User Story:** Là một user đã đăng nhập, tôi muốn đọc sách đã được duyệt, để truy cập nội dung một cách an toàn và nhanh chóng.

#### Acceptance Criteria

1. WHEN user request đọc sách THEN Lambda SHALL kiểm tra sách có status `APPROVED`
2. IF sách chưa được approve THEN hệ thống SHALL trả về `403 Forbidden`
3. WHEN sách đã approve THEN Lambda SHALL tạo CloudFront Signed URL với TTL 1 giờ
4. WHEN user truy cập Signed URL THEN CloudFront SHALL phân phối file từ S3 qua CDN
5. WHEN truy cập trực tiếp S3 THEN S3 SHALL chặn request (chỉ cho phép qua CloudFront OAC)
6. WHEN Signed URL hết hạn THEN user SHALL phải request URL mới

### Requirement 8: Xây dựng hệ thống tìm kiếm

**User Story:** Là một user, tôi muốn tìm kiếm sách theo tiêu đề hoặc tác giả, để nhanh chóng tìm thấy tài liệu cần thiết.

#### Acceptance Criteria

1. WHEN user search theo title THEN Lambda SHALL query DynamoDB GSI cho title
2. WHEN user search theo author THEN Lambda SHALL query DynamoDB GSI cho author
3. WHEN search THEN hệ thống SHALL không sử dụng Scan operation (phải dùng Query với GSI)
4. WHEN trả về kết quả THEN hệ thống SHALL chỉ trả về các sách có status `APPROVED`
5. WHEN search với nhiều điều kiện THEN hệ thống SHALL hỗ trợ filter kết hợp

### Requirement 9: Xây dựng Database Schema với DynamoDB

**User Story:** Là một developer, tôi muốn thiết kế schema DynamoDB tối ưu, để lưu trữ và truy vấn dữ liệu hiệu quả.

#### Acceptance Criteria

1. WHEN thiết kế bảng THEN bảng SHALL có partition key là `PK` và sort key là `SK`
2. WHEN lưu metadata sách THEN record SHALL chứa: bookId, title, author, uploader, status, uploadTimestamp, fileSize, s3Key
3. WHEN tạo GSI cho search THEN hệ thống SHALL có GSI1 (title) và GSI2 (author)
4. WHEN query THEN hệ thống SHALL sử dụng single-table design pattern
5. WHEN cập nhật status THEN hệ thống SHALL sử dụng conditional update để tránh race condition

### Requirement 10: Xây dựng hệ thống bảo mật và validation

**User Story:** Là một system administrator, tôi muốn hệ thống có các cơ chế bảo mật và validation, để ngăn chặn các cuộc tấn công và lạm dụng.

#### Acceptance Criteria

1. WHEN file được upload THEN Lambda SHALL validate MIME type bằng magic bytes (không tin vào file extension)
2. IF MIME type không hợp lệ THEN Lambda SHALL xóa file và cập nhật status `REJECTED_INVALID_TYPE`
3. WHEN cấu hình S3 THEN bucket SHALL chặn public access và chỉ cho phép CloudFront OAC
4. WHEN cấu hình IAM THEN mỗi Lambda SHALL có role riêng với quyền tối thiểu
5. WHEN cấu hình API Gateway THEN API SHALL có rate limiting và throttling
6. WHEN file pending quá 72 giờ THEN Lambda SHALL tự động xóa file

### Requirement 11: Xây dựng hệ thống monitoring và logging

**User Story:** Là một DevOps engineer, tôi muốn giám sát hệ thống và xem logs, để phát hiện và xử lý sự cố kịp thời.

#### Acceptance Criteria

1. WHEN Lambda chạy THEN logs SHALL được ghi vào CloudWatch Logs
2. WHEN có lỗi THEN CloudWatch Alarm SHALL gửi thông báo khi error rate > 5%
3. WHEN chi phí tăng THEN AWS Budget Alert SHALL gửi cảnh báo khi vượt ngưỡng
4. WHEN cần debug THEN logs SHALL chứa đủ thông tin: requestId, userId, action, timestamp, error details
5. WHEN retention THEN CloudWatch Logs SHALL được giữ trong 14 ngày

### Requirement 12: Deploy và CI/CD

**User Story:** Là một developer, tôi muốn deploy code lên AWS một cách tự động, để tăng tốc độ phát triển và giảm lỗi thủ công.

#### Acceptance Criteria

1. WHEN deploy THEN developer SHALL sử dụng AWS CDK để deploy toàn bộ infrastructure
2. WHEN code thay đổi THEN hệ thống SHALL tự động chạy tests trước khi deploy
3. WHEN deploy thành công THEN hệ thống SHALL có rollback mechanism nếu có lỗi
4. WHEN deploy THEN hệ thống SHALL deploy theo môi trường (dev, staging, prod)
5. WHEN cần rollback THEN developer SHALL có thể rollback về version trước đó
