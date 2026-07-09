import unittest
from unittest.mock import MagicMock, patch
import os
import json
import sys

# 1. Mock 'boto3' trực tiếp vào sys.modules trước khi import các Lambda.
# Điều này giúp test chạy thành công 100% kể cả khi môi trường local chưa cài đặt boto3 (pip install boto3).
mock_boto3 = MagicMock()
sys.modules['boto3'] = mock_boto3
sys.modules['boto3.dynamodb'] = MagicMock()
mock_conditions = MagicMock()
mock_conditions.Attr = MagicMock()
sys.modules['boto3.dynamodb.conditions'] = mock_conditions

# Khởi tạo sẵn các client mock để cấu hình side_effect
mock_sqs = MagicMock()
mock_ecs = MagicMock()
mock_dynamodb = MagicMock()
mock_s3 = MagicMock()
mock_ses = MagicMock()
mock_secretsmanager = MagicMock()
mock_logs = MagicMock()

def get_mock_client(service_name, *args, **kwargs):
    clients = {
        'sqs': mock_sqs,
        'ecs': mock_ecs,
        'dynamodb': mock_dynamodb,
        's3': mock_s3,
        'ses': mock_ses,
        'secretsmanager': mock_secretsmanager,
        'logs': mock_logs
    }
    return clients.get(service_name, MagicMock())

# Gán side_effect để khi các file lambda gọi boto3.client('abc') sẽ nhận lại đúng mock tương ứng
mock_boto3.client.side_effect = get_mock_client

# 2. Thêm các thư mục Lambda vào sys.path để Python định tuyến import đúng
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(BASE_DIR, 'lambda-backend'))
sys.path.append(os.path.join(BASE_DIR, 'lambda-coordinator'))
sys.path.append(os.path.join(BASE_DIR, 'lambda-error-handler'))
sys.path.append(os.path.join(BASE_DIR, 'lambda-postprocessing'))

# Cấu hình các biến môi trường giả lập cho Lambda dưới local
os.environ['TASK_QUEUE_URL'] = 'https://sqs.ap-southeast-1.amazonaws.com/123456789012/playwright-task-queue'
os.environ['ECS_CLUSTER_NAME'] = 'playwright-cluster'
os.environ['ECS_TASK_DEFINITION'] = 'playwright-task-def'
os.environ['SUBNET_IDS'] = 'subnet-12345,subnet-67890'
os.environ['SECURITY_GROUP_IDS'] = 'sg-12345'
os.environ['CONTAINER_NAME'] = 'playwright-container'
os.environ['TEST_HISTORY_TABLE'] = 'playwright-test-history'
os.environ['ERROR_DYNAMODB_TABLE'] = 'playwright-error-log'
os.environ['LOG_GROUP_NAME'] = '/ecs/playwright-runner'
os.environ['REPORT_BUCKET'] = 'playwright-report-12345'
os.environ['OPENAI_SECRET_NAME'] = 'playwright/openai-api-key'
os.environ['SES_SENDER_EMAIL'] = 'sender@example.com'

# 3. Sử dụng importlib để nạp động các Lambda module từ đường dẫn vật lý.
# Cách này giúp loại bỏ hoàn toàn các lỗi cảnh báo gạch đỏ (unresolved import) của IDE (như Pylance/PyCharm)
# do không sử dụng câu lệnh import trực tiếp đối với các thư mục có tên chứa ký tự gạch ngang.
import importlib.util

def load_lambda_module(module_name, relative_path):
    file_path = os.path.join(BASE_DIR, relative_path)
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None:
        raise ImportError(f"Cannot find module {module_name} at {file_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module

lambda_backend = load_lambda_module('lambda_function', 'lambda-backend/lambda_function.py')
lambda_coodinator = load_lambda_module('lambda_coodinator', 'lambda-coordinator/lambda_function.py')
lambda_error_handler = load_lambda_module('lambda_error_handler', 'lambda-error-handler/lambda_error_handler.py')
lambda_postprocessing = load_lambda_module('lambda_postprocessing', 'lambda-postprocessing/lambda_postprocessing.py')



class TestPlaywrightLambdas(unittest.TestCase):

    def setUp(self):
        # Reset trạng thái các client mock trước mỗi test case để tránh ảnh hưởng chéo
        mock_sqs.reset_mock()
        mock_ecs.reset_mock()
        mock_dynamodb.reset_mock()
        mock_s3.reset_mock()
        mock_ses.reset_mock()
        mock_secretsmanager.reset_mock()
        mock_logs.reset_mock()

        # Nạp dữ liệu các event từ thư mục test-events
        with open(os.path.join(BASE_DIR, 'test-events', 'test_event_backend.json'), 'r', encoding='utf-8') as f:
            self.event_api_gateway = json.load(f)
            
        with open(os.path.join(BASE_DIR, 'test-events', 'test_event_coordinator.json'), 'r', encoding='utf-8') as f:
            self.event_sqs = json.load(f)
            
        with open(os.path.join(BASE_DIR, 'test-events', 'test_event_error_handler.json'), 'r', encoding='utf-8') as f:
            self.event_dlq = json.load(f)

        with open(os.path.join(BASE_DIR, 'test-events', 'event_postprocessing.json'), 'r', encoding='utf-8') as f:
            self.event_postprocessing = json.load(f)

    def test_lambda_backend_success(self):
        """Test Lambda Backend nhận event từ API Gateway và gửi vào SQS thành công"""
        # Giả lập response gửi SQS
        mock_sqs.send_message.return_value = {
            'MessageId': 'msg-123456'
        }
        
        response = lambda_backend.lambda_handler(self.event_api_gateway, None)

        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('task_id', body)
        self.assertEqual(body['message_id'], 'msg-123456')
        
        # Kiểm tra SQS.send_message được gọi đúng tham số
        mock_sqs.send_message.assert_called_once()
        call_kwargs = mock_sqs.send_message.call_args[1]
        self.assertEqual(call_kwargs['QueueUrl'], os.environ['TASK_QUEUE_URL'])

    def test_lambda_coordinator_success(self):
        """Test Lambda Coordinator nhận tin nhắn SQS, cập nhật DB 'running' và trigger ECS"""
        mock_ecs.run_task.return_value = {'failures': []}
        mock_dynamodb.put_item.return_value = {}

        response = lambda_coodinator.lambda_handler(self.event_sqs, None)

        self.assertEqual(response['statusCode'], 200)
        
        # Kiểm tra DynamoDB cập nhật trạng thái 'running'
        mock_dynamodb.put_item.assert_called_once()
        db_kwargs = mock_dynamodb.put_item.call_args[1]
        self.assertEqual(db_kwargs['TableName'], os.environ['TEST_HISTORY_TABLE'])
        self.assertEqual(db_kwargs['Item']['status']['S'], 'running')
        
        # Kiểm tra ECS RunTask được gọi đúng cấu hình
        mock_ecs.run_task.assert_called_once()
        ecs_kwargs = mock_ecs.run_task.call_args[1]
        self.assertEqual(ecs_kwargs['cluster'], os.environ['ECS_CLUSTER_NAME'])
        self.assertEqual(ecs_kwargs['launchType'], 'FARGATE')
        self.assertEqual(
            ecs_kwargs['networkConfiguration']['awsvpcConfiguration']['assignPublicIp'], 
            'DISABLED'
        )

    def test_lambda_error_handler_success(self):
        """Test Lambda Error Handler nhận tin nhắn từ DLQ, ghi log lỗi và update status=failed"""
        mock_dynamodb.put_item.return_value = {}
        mock_dynamodb.update_item.return_value = {}

        response = lambda_error_handler.lambda_handler(self.event_dlq, None)

        self.assertEqual(response['statusCode'], 200)
        
        # Kiểm tra ghi vào error log table
        mock_dynamodb.put_item.assert_called_once()
        err_log_kwargs = mock_dynamodb.put_item.call_args[1]
        self.assertEqual(err_log_kwargs['TableName'], os.environ['ERROR_DYNAMODB_TABLE'])
        self.assertEqual(
            err_log_kwargs['Item']['error_message']['S'], 
            'Unknown error (DLQ Triggered)'
        )
        
        # Kiểm tra cập nhật status='failed' trong history table
        mock_dynamodb.update_item.assert_called_once()
        history_kwargs = mock_dynamodb.update_item.call_args[1]
        self.assertEqual(history_kwargs['TableName'], os.environ['TEST_HISTORY_TABLE'])
        self.assertEqual(history_kwargs['ExpressionAttributeValues'][':status']['S'], 'failed')

    @patch('urllib.request.urlopen')
    def test_lambda_postprocessing_success(self, mock_urlopen):
        """Test Lambda Postprocessing xử lý sự kiện STOPPED của ECS Fargate"""
        # Event mô phỏng từ EventBridge gửi sang khi Task STOPPED
        event_eb = self.event_postprocessing

        # Giả lập trả về từ CloudWatch Logs
        mock_logs.get_log_events.return_value = {
            'events': [{'message': 'Playwright test passed successfully!'}]
        }
        # Giả lập presigned URL
        mock_s3.generate_presigned_url.return_value = 'https://s3.presigned.url/report.html'
        # Giả lập secret OpenAI API key
        mock_secretsmanager.get_secret_value.return_value = {'SecretString': '{"api_key": "sk-mock-key"}'}
        
        # Giả lập HTTP response trả về từ OpenAI API (urllib)
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({
            "choices": [{"message": {"content": "Tóm tắt: Tất cả các bài kiểm thử Playwright đều hoạt động thành công."}}]
        }).encode('utf-8')
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        # Giả lập DynamoDB và SES
        mock_dynamodb.update_item.return_value = {}
        mock_ses.send_email.return_value = {'MessageId': 'email-msg-999'}

        response = lambda_postprocessing.lambda_handler(event_eb, None)

        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertEqual(body['status'], 'success')
        self.assertEqual(body['task_id'], '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')

        # Xác thực DynamoDB update_item được gọi đúng trạng thái 'success'
        self.assertEqual(mock_dynamodb.update_item.call_count, 2)
        db_kwargs = mock_dynamodb.update_item.call_args_list[-1][1]
        self.assertEqual(db_kwargs['ExpressionAttributeValues'][':status']['S'], 'success')
        self.assertEqual(db_kwargs['ExpressionAttributeValues'][':report']['S'], 'https://s3.presigned.url/report.html')

        # Xác thực SES gửi mail được gọi
        mock_ses.send_email.assert_called_once()


if __name__ == '__main__':
    unittest.main()
