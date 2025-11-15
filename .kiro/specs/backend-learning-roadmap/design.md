# Design Document

## Overview

Tài liệu này mô tả thiết kế chi tiết cho lộ trình học và xây dựng backend của hệ thống Thư Viện Online. Lộ trình được chia thành 6 tuần với các module học tập và thực hành tăng dần độ phức tạp.

### Learning Path Structure

Lộ trình học được thiết kế theo mô hình "Learn → Practice → Build":
1. **Learn**: Học lý thuyết và khái niệm
2. **Practice**: Thực hành với ví dụ đơn giản
3. **Build**: Xây dựng tính năng thực tế cho dự án

### Technology Stack

- **Language**: Python 3.11 (cho Lambda functions)
- **IaC**: AWS CDK (TypeScript hoặc Python)
- **AWS Services**: Lambda, API Gateway (HTTP API), DynamoDB, S3, Cognito, CloudFront, IAM, CloudWatch
- **Tools**: AWS CLI, Git, Postman/Thunder Client

## Architecture

### High-Level Architecture

```
User/Admin
    ↓
[CloudFront] ← Signed URL for content delivery
    ↓
[API Gateway HTTP API] ← JWT Authentication
    ↓
[Lambda Functions] ← Business Logic
    ↓ ↓ ↓
[Cognito] [DynamoDB] [S3]
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│              API Gateway (HTTP API)                      │
│  - JWT Authorizer (Cognito)                             │
│  - Rate Limiting & Throttling                           │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
