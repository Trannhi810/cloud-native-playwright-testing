import os
import sys
import json
import logging
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

# Thêm thư mục lambda-backend vào đường dẫn để import
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(BASE_DIR, 'lambda-backend'))

# Thiết lập các biến môi trường giả lập (để tránh lỗi thiếu biến)
os.environ.setdefault('TEST_HISTORY_TABLE', 'playwright-test-history')
os.environ.setdefault('TEST_SUITES_TABLE', 'playwright-test-suites')
os.environ.setdefault('TASK_QUEUE_URL', 'https://sqs.ap-southeast-1.amazonaws.com/123456789012/playwright-task-queue')
os.environ.setdefault('EMAIL_CONFIG_TABLE', 'playwright-email-config')

# ===== Bổ sung Mock Boto3 =====
# Vì máy bạn chưa cài boto3 và chưa cấu hình AWS, tôi sẽ tạo mock (dữ liệu giả)
# để server không bị lỗi và trả về dữ liệu ảo cho Frontend.
from unittest.mock import MagicMock

mock_boto3 = MagicMock()
sys.modules['boto3'] = mock_boto3
sys.modules['boto3.dynamodb'] = MagicMock()
mock_conditions = MagicMock()
mock_conditions.Attr = MagicMock()
sys.modules['boto3.dynamodb.conditions'] = mock_conditions

mock_dynamodb = MagicMock()
mock_table = MagicMock()
mock_table.scan.return_value = {
    'Items': [
        {
            'task_id': 'mock-id-1234',
            'target_url': 'https://google.com',
            'test_script': 'Search Test',
            'status': 'success',
            'started_at': '2026-07-07T08:00:00Z',
            'finished_at': '2026-07-07T08:01:30Z',
            'triggered_by': 'manual',
            'ai_summary': 'Tất cả các step đều pass.'
        }
    ]
}
mock_table.get_item.return_value = {
    'Item': mock_table.scan.return_value['Items'][0]
}
mock_dynamodb.Table.return_value = mock_table
mock_boto3.resource.return_value = mock_dynamodb

# pyrefly: ignore [missing-import]
import lambda_backend

# ===== In-memory stores (thay thế AWS khi chạy local) =====
_schedules_store = []
_users_store = []
_test_suites_store = []
_emails_store = []

def _local_get_test_suites():
    return {'statusCode': 200, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps(_test_suites_store, ensure_ascii=False)}

def _local_post_test_suites(body):
    import time
    new_id = str(int(time.time() * 1000))
    _test_suites_store.append({
        'id': new_id,
        'suite_id': new_id,
        'name': body.get('name', 'Untitled'),
        'website': body.get('target_url', ''),
        'description': body.get('description', ''),
        'cases': 0, 'size': '—', 'updatedAt': 'Vừa xong', 'status': 'active'
    })
    return {'statusCode': 200, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'OK', 'id': new_id}, ensure_ascii=False)}

def _local_delete_test_suites(suite_id):
    global _test_suites_store
    _test_suites_store = [s for s in _test_suites_store if s.get('id') != suite_id and s.get('suite_id') != suite_id]
    return {'statusCode': 200, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'OK'}, ensure_ascii=False)}

def _local_get_emails():
    return {'statusCode': 200, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps(_emails_store, ensure_ascii=False)}

def _local_post_emails(body):
    email = body.get('email_address')
    if not email: return {'statusCode': 400, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': '{"message": "Missing email"}'}
    existing = next((e for e in _emails_store if e['email_address'] == email), None)
    if existing:
        existing['active'] = body.get('active', existing['active'])
    else:
        _emails_store.append({'email_address': email, 'active': body.get('active', True)})
    return {'statusCode': 200, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'OK'}, ensure_ascii=False)}

def _local_delete_emails(email):
    global _emails_store
    _emails_store = [e for e in _emails_store if e.get('email_address') != email]
    return {'statusCode': 200, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'OK'}, ensure_ascii=False)}


def _local_get_schedules():
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(_schedules_store, ensure_ascii=False)
    }

def _local_post_schedules(body):
    import time
    new_id = str(int(time.time() * 1000))
    _schedules_store.append({
        'id': new_id,
        'name': body.get('name', 'Untitled'),
        'website': body.get('website', ''),
        'env': body.get('env', 'Production'),
        'cron': body.get('cron', '0 2 * * *'),
        'humanCron': body.get('cron', '0 2 * * *'),
        'status': 'active',
        'lastRun': '—',
        'nextRun': '—'
    })
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'message': 'Tạo lịch thành công', 'id': new_id}, ensure_ascii=False)
    }

def _local_delete_schedules(schedule_id):
    global _schedules_store
    _schedules_store = [s for s in _schedules_store if s.get('id') != schedule_id]
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'message': 'Đã xóa lịch'}, ensure_ascii=False)
    }

def _local_get_users():
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(_users_store, ensure_ascii=False)
    }

def _local_post_users(body):
    import time
    new_id = str(int(time.time() * 1000))
    _users_store.append({
        'id': new_id,
        'user_id': new_id,
        'name': body.get('name', ''),
        'email': body.get('email', ''),
        'role': body.get('role', 'qa'),
        'status': 'active',
        'lastLogin': '—'
    })
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'message': 'Tạo user thành công', 'user_id': new_id}, ensure_ascii=False)
    }

def _local_delete_users(user_id):
    global _users_store
    _users_store = [u for u in _users_store if u.get('user_id') != user_id]
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'message': 'Đã xóa user'}, ensure_ascii=False)
    }

# Monkey-patch: override AWS handlers bằng local in-memory versions
lambda_backend.handle_get_schedules = _local_get_schedules
lambda_backend.handle_post_schedules = _local_post_schedules
lambda_backend.handle_delete_schedules = _local_delete_schedules
lambda_backend.handle_get_users = _local_get_users
lambda_backend.handle_post_users = _local_post_users
lambda_backend.handle_delete_users = _local_delete_users
lambda_backend.handle_get_test_suites = _local_get_test_suites
lambda_backend.handle_post_test_suites = _local_post_test_suites
lambda_backend.handle_delete_test_suites = _local_delete_test_suites
lambda_backend.handle_get_emails = _local_get_emails
lambda_backend.handle_post_emails = _local_post_emails
lambda_backend.handle_delete_emails = _local_delete_emails

class APIGatewayHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        # Trả lời preflight request của CORS từ Frontend
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-type, Authorization")
        self.end_headers()

    def handle_request(self, method):
        parsed_path = urlparse(self.path)
        raw_path = parsed_path.path
        
        # Đọc body từ request
        body = ""
        if 'Content-Length' in self.headers:
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length).decode('utf-8')
            
        # Giả lập Event của API Gateway
        event = {
            'rawPath': raw_path,
            'requestContext': {
                'http': {
                    'method': method
                },
                'authorizer': {
                    'jwt': {
                        'claims': {
                            'cognito:groups': ['Admin', 'QA'] # Giả lập quyền để gọi được /trigger
                        }
                    }
                }
            },
            'body': body
        }
        
        print(f"[{method}] {raw_path}")
        
        try:
            # Gọi trực tiếp hàm lambda_handler
            response = lambda_backend.lambda_handler(event, None)
            
            # Gửi Status Code
            status_code = response.get('statusCode', 500)
            self.send_response(status_code)
            
            # Gửi Headers (đảm bảo có CORS)
            headers = response.get('headers', {})
            for k, v in headers.items():
                if k.lower() != 'access-control-allow-origin':
                    self.send_header(k, v)
                
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.end_headers()
            
            # Gửi Body
            if 'body' in response:
                self.wfile.write(response['body'].encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

    def do_GET(self):
        self.handle_request('GET')

    def do_POST(self):
        self.handle_request('POST')

    def do_DELETE(self):
        self.handle_request('DELETE')

def run(port=3001):
    server_address = ('', port)
    httpd = HTTPServer(server_address, APIGatewayHandler)
    print(f'=============================================')
    print(f'Local API Gateway is running on port {port}')
    print(f'URL: http://localhost:{port}')
    print(f'=============================================')
    print(f'Press Ctrl+C to stop the server.')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print('Server stopped.')

if __name__ == '__main__':
    run()
