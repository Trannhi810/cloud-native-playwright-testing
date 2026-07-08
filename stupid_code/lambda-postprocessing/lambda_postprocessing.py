import json
import os
import boto3
import botocore
import logging
import datetime
import urllib.request
import urllib.error

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.client('dynamodb')
s3 = boto3.client('s3')
ses = boto3.client('ses')
secretsmanager = boto3.client('secretsmanager')
logs_client = boto3.client('logs')


def get_email_recipients():
    """
    Đọc danh sách địa chỉ email từ bảng DynamoDB playwright-email-config.
    Nếu không lấy được, fallback về dùng sender_email.
    """
    email_table = os.environ.get('EMAIL_CONFIG_TABLE', '')
    sender_email = os.environ.get('SES_SENDER_EMAIL', '')
    if not email_table:
        logger.warning("EMAIL_CONFIG_TABLE not set, falling back to sender email.")
        return [sender_email]
    try:
        response = dynamodb.scan(TableName=email_table)
        items = response.get('Items', [])
        recipients = []
        for item in items:
            email_addr = item.get('email_address', {}).get('S', '')
            active_val = item.get('active', {}).get('BOOL', True)
            if email_addr and active_val:
                recipients.append(email_addr)
        if not recipients:
            logger.warning("No active recipients found in email config table, falling back to sender email.")
            return [sender_email]
        logger.info(f"Loaded {len(recipients)} recipient(s) from DynamoDB: {recipients}")
        return recipients
    except Exception as e:
        logger.error(f"Failed to read email config from DynamoDB: {str(e)}")
        return [sender_email]


def get_cloudwatch_logs(task_arn, log_group):
    """
    Lấy log của ECS task từ CloudWatch Logs.
    Log stream name theo format chuẩn của ECS: <family>/<container>/<task-id>
    """
    if not task_arn:
        logger.warning("No task_arn provided, skipping CloudWatch logs retrieval.")
        return ""
    try:
        task_id_short = task_arn.split('/')[-1]
        log_stream_name = f"playwright-runner/playwright-container/{task_id_short}"

        logger.info(f"Fetching logs from stream: {log_stream_name}")
        response = logs_client.get_log_events(
            logGroupName=log_group,
            logStreamName=log_stream_name,
            limit=200,
            startFromHead=True
        )

        events = response.get('events', [])
        log_text = '\n'.join([e.get('message', '') for e in events])
        logger.info(f"Retrieved {len(events)} log events from CloudWatch")
        return log_text

    except logs_client.exceptions.ResourceNotFoundException:
        logger.warning(f"Log stream not found: {log_stream_name}")
        return ""
    except Exception as e:
        logger.error(f"Failed to get CloudWatch logs: {str(e)}")
        return ""


def get_report_presigned_url(task_id, report_bucket):
    """
    Tạo S3 Presigned URL cho file báo cáo HTML của phiên test.
    Đã bổ sung logic kiểm tra sự tồn tại của file trước khi tạo URL.
    """
    try:
        report_key = f"reports/{task_id}/index.html"
        try:
            s3.head_object(Bucket=report_bucket, Key=report_key)
        except botocore.exceptions.ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            if error_code in ['404', '403']:
                logger.warning(f"Report index.html not found for task {task_id}. Skipping URL generation.")
                return ""
            else:
                logger.error(f"Error checking report existence: {str(e)}")
                return ""

        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': report_bucket, 'Key': report_key},
            ExpiresIn=86400 
        )
        logger.info(f"Generated presigned URL for report key: {report_key}")
        return url
    except Exception as e:
        logger.error(f"Failed to generate presigned URL: {str(e)}")
        return ""


def get_ai_api_key(secret_name):
    """
    Lấy Google Gemini API Key từ AWS Secrets Manager.
    (Biến môi trường: OPENAI_SECRET_NAME — giữ tên cũ để tương thích, nhưng thực tế lưu Gemini API Key)
    """
    try:
        response = secretsmanager.get_secret_value(SecretId=secret_name)
        secret_string = response.get('SecretString', '{}')
        try:
            secret_data = json.loads(secret_string)
            return secret_data.get('api_key', secret_string)
        except json.JSONDecodeError:
            return secret_string
    except Exception as e:
        logger.error(f"Failed to get OpenAI API key from Secrets Manager: {str(e)}")
        return ""


def summarize_with_ai(api_key, log_text, status):
    """
    Gọi Google Gemini API để tóm tắt kết quả test bằng tiếng Việt.
    """
    if not api_key:
        logger.warning("No API key available, skipping AI summary.")
        return "Không thể tóm tắt: thiếu API key."

    if not log_text:
        logger.warning("No log text available, skipping AI summary.")
        return "Không có log để phân tích."

    try:
        status_label = 'PASSED' if status == 'success' else 'FAILED'
        prompt = (
            f"Bạn là chuyên gia QA. Phân tích log kiểm thử Playwright sau và tóm tắt ngắn gọn bằng tiếng Việt.\n"
            f"Trạng thái tổng thể: {status_label}\n"
            f"Log:\n{log_text[:3000]}\n\n"
            f"Hãy chỉ ra: 1) Kết quả tổng thể, 2) Lỗi chính (nếu có), 3) Đề xuất khắc phục (nếu cần). "
            f"Trả lời trong tối đa 150 từ."
        )

        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": 300,
                "temperature": 0.3
            }
        }).encode('utf-8')

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            summary = result['candidates'][0]['content']['parts'][0]['text'].strip()
            logger.info("AI summary generated successfully via Gemini.")
            return summary

    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        logger.error(f"Gemini API HTTP error {e.code}: {error_body}")
        return f"Không thể tóm tắt: Lỗi Gemini API (HTTP {e.code})."
    except Exception as e:
        logger.error(f"Failed to call AI API: {str(e)}")
        return "Không thể tóm tắt: Lỗi kết nối đến AI."


def update_test_history(history_table, task_id, status, report_url, ai_summary):
    """
    Cập nhật bản ghi kết quả test vào DynamoDB playwright-test-history.
    """
    try:
        dynamodb.update_item(
            TableName=history_table,
            Key={'task_id': {'S': task_id}},
            UpdateExpression=(
                "SET #s = :status, "
                "finished_at = :finished, "
                "report_url = :report, "
                "ai_summary = :ai"
            ),
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':status':   {'S': status},
                ':finished': {'S': datetime.datetime.utcnow().isoformat() + 'Z'},
                ':report':   {'S': report_url},
                ':ai':       {'S': ai_summary}
            }
        )
        logger.info(f"Updated DynamoDB for task {task_id}: status={status}")
    except Exception as e:
        logger.error(f"Failed to update DynamoDB test history: {str(e)}")
        raise e


def load_email_template(task_id, status_label, target_url, ai_summary, report_url):
    """
    Đọc HTML template từ file templates/email_report.html
    và thay thế các placeholder bằng giá trị thực. Đọc thêm CSS từ style.css.
    """
    template_path = os.path.join(os.path.dirname(__file__), 'templates', 'email_report.html')
    css_path = os.path.join(os.path.dirname(__file__), 'templates', 'style.css')
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            html = f.read()
            
        css_content = ""
        if os.path.exists(css_path):
            with open(css_path, 'r', encoding='utf-8') as f:
                css_content = f.read()

        report_link_html = (
            f"<p><b>Xem báo cáo chi tiết:</b> <a href='{report_url}'>Click vào đây</a></p>"
            if report_url else ""
        )

        css_style_tag = f"<style>\n{css_content}\n</style>" if css_content else ""
        html = html.replace('<link rel="stylesheet" href="style.css">', css_style_tag)
        html = html.replace('{{task_id}}', task_id)
        html = html.replace('{{target_url}}', target_url)
        html = html.replace('{{status_label}}', status_label)
        html = html.replace('{{ai_summary}}', ai_summary)
        html = html.replace('{{report_link}}', report_link_html)
        return html

    except Exception as e:
        logger.error(f"Failed to load email template: {str(e)}")
        return f"<p>Task: {task_id} | Status: {status_label} | AI: {ai_summary}</p>"


def send_report_email(sender_email, task_id, status, target_url, report_url, ai_summary):
    """
    Gửi email báo cáo kết quả test qua Amazon SES.
    """
    try:
        status_label = '✅ PASSED' if status == 'success' else '❌ FAILED'
        subject = f"[Playwright] Kết quả kiểm thử {status_label} — Task {task_id[:8]}"

        body_html = load_email_template(task_id, status_label, target_url, ai_summary, report_url)

        body_text = (
            f"Task ID: {task_id}\n"
            f"URL kiểm thử: {target_url}\n"
            f"Trạng thái: {status_label}\n"
            f"AI Tóm tắt: {ai_summary}\n"
            f"Báo cáo: {report_url}"
        )

        recipient_list = get_email_recipients()
        logger.info(f"Sending email to {len(recipient_list)} recipient(s): {recipient_list}")

        response = ses.send_email(
            Source=sender_email,
            Destination={'ToAddresses': recipient_list},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Text': {'Data': body_text, 'Charset': 'UTF-8'},
                    'Html': {'Data': body_html, 'Charset': 'UTF-8'}
                }
            }
        )
        logger.info(f"Email sent successfully. SES MessageId: {response['MessageId']}")

    except Exception as e:
        logger.error(f"Failed to send SES email: {str(e)}")


def lambda_handler(event, context):
    """
    Được trigger trực tiếp từ Fargate (Docker Container) khi kết thúc chạy Playwright.
    Payload đầu vào:
    {
      "task_id": "...",
      "status": "success" | "failed",
      "target_url": "...",
      "task_arn": "..."
    }
    """
    try:
        logger.info(f"Received event from Fargate: {json.dumps(event)}")

        log_group    = os.environ['LOG_GROUP_NAME']
        history_table = os.environ['TEST_HISTORY_TABLE']
        report_bucket = os.environ['REPORT_BUCKET']
        secret_name  = os.environ['OPENAI_SECRET_NAME']
        sender_email = os.environ['SES_SENDER_EMAIL']

        if event.get('source') == 'aws.ecs' and event.get('detail-type') == 'ECS Task State Change':
            detail = event.get('detail', {})
            task_arn = detail.get('taskArn', '')
            
            status = 'failed'
            for c in detail.get('containers', []):
                if c.get('exitCode') == 0:
                    status = 'success'
                else:
                    status = 'failed'
                    break
                    
            task_id = None
            target_url = ''
            for override in detail.get('overrides', {}).get('containerOverrides', []):
                for env in override.get('environment', []):
                    if env.get('name') == 'TASK_PAYLOAD':
                        try:
                            payload = json.loads(env.get('value', '{}'))
                            task_id = payload.get('task_id')
                            target_url = payload.get('target_url', '')
                        except:
                            pass
        else:
            task_id    = event.get('task_id')
            status     = event.get('status')
            target_url = event.get('target_url', '')
            task_arn   = event.get('task_arn', '')

        if not task_id:
            logger.error("Missing required field: task_id")
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'Missing task_id'})
            }

        if not status:
            logger.error("Missing required field: status")
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'Missing status'})
            }

        logger.info(f"Starting post-processing for task_id: {task_id}, status: {status}")

        log_text = get_cloudwatch_logs(task_arn, log_group)
        report_url = get_report_presigned_url(task_id, report_bucket)
        api_key    = get_ai_api_key(secret_name)
        ai_summary = summarize_with_ai(api_key, log_text, status)

        update_test_history(history_table, task_id, status, report_url, ai_summary)
        send_report_email(sender_email, task_id, status, target_url, report_url, ai_summary)

        logger.info(f"Post-processing completed for task_id: {task_id}")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Post-processing completed successfully',
                'task_id': task_id,
                'status': status
            })
        }

    except Exception as e:
        logger.error(f"Critical error in post-processing lambda: {str(e)}")
        raise e