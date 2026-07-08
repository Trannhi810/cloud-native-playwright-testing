import json
import os
import boto3
import logging
import uuid
from boto3.dynamodb.conditions import Attr

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')
scheduler = boto3.client('scheduler')

def handle_get_history():
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return {'statusCode': 500, 'body': json.dumps({'message': 'Thiếu biến môi trường TEST_HISTORY_TABLE'})}
        table = dynamodb.Table(table_name)
        response = table.scan()
        items = response.get('Items', [])
        items.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(items, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error fetching history: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

def handle_get_reports():
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return {'statusCode': 500, 'body': json.dumps({'message': 'Thiếu biến môi trường TEST_HISTORY_TABLE'})}
        table = dynamodb.Table(table_name)
        response = table.scan(
            FilterExpression=Attr('status').eq('success') & Attr('report_url').exists()
        )
        items = response.get('Items', [])
        items.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(items, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error fetching reports: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

def handle_get_schedules():
    try:
        response = scheduler.list_schedules()
        schedules = response.get('Schedules', [])
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(schedules, default=str, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error fetching schedules: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

def handle_get_test_suites():
    try:
        table_name = os.environ.get('TEST_SUITES_TABLE')
        if not table_name:
            return {'statusCode': 500, 'body': json.dumps({'message': 'Thiếu biến môi trường TEST_SUITES_TABLE'})}
        table = dynamodb.Table(table_name)
        response = table.scan()
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(response.get('Items', []), ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error fetching test suites: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

def handle_post_test_suites(body):
    try:
        table_name = os.environ.get('TEST_SUITES_TABLE')
        table = dynamodb.Table(table_name)
        suite_id = body.get('suite_id') or str(uuid.uuid4())
        item = {
            'suite_id': suite_id,
            'name': body.get('name', 'Untitled Suite'),
            'target_url': body.get('target_url', ''),
            'test_script': body.get('test_script', '')
        }
        table.put_item(Item=item)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Tạo Test Suite thành công', 'suite_id': suite_id}, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error creating test suite: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

def handle_get_emails():
    try:
        table_name = os.environ.get('EMAIL_CONFIG_TABLE')
        if not table_name:
            return {'statusCode': 500, 'body': json.dumps({'message': 'Thiếu biến môi trường EMAIL_CONFIG_TABLE'})}
        table = dynamodb.Table(table_name)
        response = table.scan()
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(response.get('Items', []), ensure_ascii=False)
        }
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

def handle_post_emails(body):
    try:
        table_name = os.environ.get('EMAIL_CONFIG_TABLE')
        table = dynamodb.Table(table_name)
        email_address = body.get('email_address')
        if not email_address:
            return {'statusCode': 400, 'body': json.dumps({'message': 'Thiếu email_address'})}
        item = {
            'email_address': email_address,
            'active': body.get('active', True)
        }
        table.put_item(Item=item)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Thêm email thành công'}, ensure_ascii=False)
        }
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

def handle_get_stats():
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return {'statusCode': 500, 'body': json.dumps({'message': 'Thiếu biến môi trường TEST_HISTORY_TABLE'})}
        table = dynamodb.Table(table_name)
        response = table.scan()
        items = response.get('Items', [])
        total = len(items)
        passed = sum(1 for i in items if i.get('status') == 'success')
        failed = sum(1 for i in items if i.get('status') == 'failed')
        running = sum(1 for i in items if i.get('status') == 'running')
        items.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        recent = items[:10]
        stats = [
            {'id': 'today', 'label': 'Lần chạy hôm nay', 'value': str(total), 'sub': f'{total} lượt kiểm thử'},
            {'id': 'passRate', 'label': 'Tỷ lệ Pass', 'value': f'{round((passed/total*100) if total>0 else 0)}%', 'sub': f'{passed}/{total} test cases'},
            {'id': 'running', 'label': 'Đang chạy', 'value': str(running), 'sub': f'{running} tiến trình', 'running': running > 0},
            {'id': 'errors', 'label': 'Lỗi', 'value': str(failed), 'sub': f'{failed} lần thất bại'},
        ]
        pie_data = []
        if passed > 0: pie_data.append({'name': 'Pass', 'value': passed, 'color': '#10b981'})
        if failed > 0: pie_data.append({'name': 'Fail', 'value': failed, 'color': '#ef4444'})
        if not pie_data: pie_data = [{'name': 'Chưa có dữ liệu', 'value': 1, 'color': '#e2e8f0'}]
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'stats': stats,
                'pieData': pie_data,
                'trendData': [],
                'recentRuns': recent
            }, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

def handle_get_test_runs(run_id=None):
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return {'statusCode': 500, 'body': json.dumps({'message': 'Thiếu biến môi trường TEST_HISTORY_TABLE'})}
        table = dynamodb.Table(table_name)
        if run_id:
            response = table.get_item(Key={'task_id': run_id})
            item = response.get('Item', {})
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(item, ensure_ascii=False)
            }
        response = table.scan()
        items = response.get('Items', [])
        items.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(items, ensure_ascii=False)
        }
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

def handle_get_users():
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps([], ensure_ascii=False)
    }

def handle_get_audit_logs():
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps([], ensure_ascii=False)
    }

def handle_get_ai_insights():
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'summary': 'Chưa có dữ liệu phân tích.'}, ensure_ascii=False)
    }

def lambda_handler(event, context):
    try:
        logger.info(f"Received event from API Gateway: {json.dumps(event)}")
        raw_path = event.get('rawPath', '/trigger')
        http_method = event.get('requestContext', {}).get('http', {}).get('method', 'POST')

        if raw_path == '/history' and http_method == 'GET':
            return handle_get_history()
        elif raw_path == '/reports' and http_method == 'GET':
            return handle_get_reports()
        elif raw_path == '/schedules' and http_method == 'GET':
            return handle_get_schedules()
        elif raw_path == '/stats' and http_method == 'GET':
            return handle_get_stats()
        elif raw_path == '/test-runs' and http_method == 'GET':
            return handle_get_test_runs()
        elif raw_path.startswith('/test-runs/') and http_method == 'GET':
            run_id = raw_path.split('/test-runs/')[-1]
            return handle_get_test_runs(run_id)
        elif raw_path == '/users' and http_method == 'GET':
            return handle_get_users()
        elif raw_path == '/audit-logs' and http_method == 'GET':
            return handle_get_audit_logs()
        elif raw_path == '/chatgpt-insights' and http_method == 'GET':
            return handle_get_ai_insights()
        elif raw_path == '/test-suites':
            if http_method == 'GET': return handle_get_test_suites()
            if http_method == 'POST': return handle_post_test_suites(json.loads(event.get('body', '{}')))
        elif raw_path == '/email-config':
            if http_method == 'GET': return handle_get_emails()
            if http_method == 'POST': return handle_post_emails(json.loads(event.get('body', '{}')))

        if 'requestContext' in event:
            groups = []
            jwt_claims = event['requestContext'].get('authorizer', {}).get('jwt', {}).get('claims', {})
            if 'cognito:groups' in jwt_claims:
                cognito_groups = jwt_claims['cognito:groups']
                if isinstance(cognito_groups, list):
                    groups = cognito_groups
                elif isinstance(cognito_groups, str):
                    cleaned = cognito_groups.strip('[]')
                    groups = [g.strip() for g in cleaned.split(',') if g.strip()]
            allowed_groups = ['Admin', 'QA']
            if not any(g in allowed_groups for g in groups):
                logger.warning(f"Access denied. User groups: {groups}")
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'Forbidden: Bạn không có quyền chạy kiểm thử. Chỉ nhóm Admin hoặc QA mới được phép.'}, ensure_ascii=False)
                }

        queue_url = os.environ['TASK_QUEUE_URL']
        body = {}
        if 'body' in event and event['body']:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        if 'task_id' not in body:
            body['task_id'] = str(uuid.uuid4())

        logger.info(f"Prepared message for SQS: {json.dumps(body)}")
        response = sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(body)
        )
        logger.info(f"Message sent to SQS, MessageId: {response['MessageId']}")
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'message': 'Yêu cầu kiểm thử đã được tiếp nhận',
                'task_id': body['task_id'],
                'message_id': response['MessageId']
            }, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error processing API request: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'message': 'Đã có lỗi xảy ra trên server', 'error': str(e)}, ensure_ascii=False)
        }