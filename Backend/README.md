# Playwright Automation on AWS

Hệ thống tự động kiểm thử Playwright bằng Docker chạy Serverless trên hạ tầng AWS.

## Cấu trúc DynamoDB Schemas (Chi tiết dữ liệu lưu trữ)

Do DynamoDB là NoSQL (Schemaless), các file JSON trong thư mục `schemas/` chỉ định nghĩa cấu trúc khóa chính (Primary Key) để khởi tạo bảng trên AWS. Chi tiết các thuộc tính (Attributes) được lưu trữ bởi ứng dụng như sau:

### 1. Bảng `playwright-test-history`
Bảng lưu trữ lịch sử các phiên chạy kiểm thử.
*   **Key chính**: `task_id` (String / HASH)
*   **Các thuộc tính phụ (Attributes)**:
    *   `target_url` (String): URL của trang web cần kiểm thử.
    *   `test_script` (String): Tên hoặc nội dung kịch bản test Playwright.
    *   `status` (String): Trạng thái phiên chạy (`running` | `success` | `failed`).
    *   `triggered_by` (String): Nguồn kích hoạt (`manual` | `schedule`).
    *   `started_at` (String): Thời gian bắt đầu (ISO 8601 UTC).
    *   `finished_at` (String): Thời gian hoàn thành (ISO 8601 UTC).
    *   `report_url` (String): S3 Presigned URL dẫn đến báo cáo HTML (hiệu lực 24h).
    *   `ai_summary` (String): Tóm tắt kết quả kiểm thử do OpenAI GPT sinh ra.

### 2. Bảng `playwright-error-log`
Bảng ghi nhận các lỗi hệ thống nghiêm trọng khi message rơi vào Dead Letter Queue (DLQ).
*   **Key chính**: `error_id` (String / HASH)
*   **Các thuộc tính phụ (Attributes)**:
    *   `original_message_id` (String): MessageId gốc từ SQS.
    *   `message_body` (String): Toàn bộ JSON payload ban đầu bị lỗi.
    *   `error_message` (String): Chi tiết lỗi hệ thống ghi nhận được.
    *   `timestamp` (String): Thời điểm xảy ra sự cố (ISO 8601 UTC).

---

## Cách tạo bảng nhanh qua AWS CLI
Bạn có thể chạy các lệnh sau để khởi tạo bảng trên AWS bằng cách sử dụng các file JSON sạch trong thư mục `schemas/`:

```bash
# Tạo bảng lịch sử test
aws dynamodb create-table --cli-input-json file://schemas/dynamodb_test_history.json --region ap-southeast-1

# Tạo bảng log lỗi hệ thống
aws dynamodb create-table --cli-input-json file://schemas/dynamodb_error_log.json --region ap-southeast-1
```
