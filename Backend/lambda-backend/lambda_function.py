import json
import os
import uuid
from core.aws import sqs, logger
from core.responses import error

from routes.history import handle_get_history, handle_get_stats
from routes.reports import handle_get_reports, handle_get_report_detail
from routes.schedules import handle_get_schedules, handle_post_schedules, handle_delete_schedules, handle_put_schedules
from routes.test_runs import handle_get_test_runs
from routes.users import handle_get_users, handle_post_users, handle_delete_users
from routes.test_suites import handle_get_test_suites, handle_post_test_suites, handle_get_test_suite_detail, handle_delete_test_suites
from routes.emails import handle_get_emails, handle_post_emails, handle_delete_emails
from routes.insights import handle_get_audit_logs, handle_get_ai_insights

def lambda_handler(event, context):
    """
    Nhận request từ API Gateway và phân luồng (Routing) dựa trên đường dẫn.
    """
    try:
        logger.info(f"Received event from API Gateway: {json.dumps(event)}")
        raw_path = event.get('rawPath') or event.get('resource') or event.get('path') or '/trigger'
        
        http_method = 'POST'
        if event.get('httpMethod'):
            http_method = event.get('httpMethod')
        elif event.get('requestContext', {}).get('http', {}).get('method'):
            http_method = event.get('requestContext', {}).get('http', {}).get('method')
        
        body_str = event.get('body', '{}')
        body_data = json.loads(body_str) if isinstance(body_str, str) and body_str else (body_str or {})

        if raw_path == '/history' and http_method == 'GET':
            return handle_get_history()
        elif raw_path == '/reports' and http_method == 'GET':
            return handle_get_reports()
        elif raw_path.startswith('/reports/') and http_method == 'GET':
            return handle_get_report_detail(raw_path.split('/reports/')[-1])
        elif raw_path == '/schedules':
            if http_method == 'GET': return handle_get_schedules()
            if http_method == 'POST': return handle_post_schedules(body_data)
        elif raw_path.startswith('/schedules/') and http_method == 'DELETE':
            return handle_delete_schedules(raw_path.split('/schedules/')[-1])
        elif raw_path.startswith('/schedules/') and http_method == 'PUT':
            return handle_put_schedules(raw_path.split('/schedules/')[-1], body_data)
        elif raw_path == '/stats' and http_method == 'GET':
            return handle_get_stats()
        elif raw_path == '/test-runs' and http_method == 'GET':
            return handle_get_test_runs()
        elif raw_path.startswith('/test-runs/') and http_method == 'GET':
            return handle_get_test_runs(raw_path.split('/test-runs/')[-1])
        elif raw_path == '/users':
            if http_method == 'GET': return handle_get_users()
            if http_method == 'POST': return handle_post_users(body_data)
        elif raw_path.startswith('/users/') and http_method == 'DELETE':
            return handle_delete_users(raw_path.split('/users/')[-1])
        elif raw_path == '/audit-logs' and http_method == 'GET':
            return handle_get_audit_logs()
        elif raw_path == '/chatgpt-insights' and http_method == 'GET':
            return handle_get_ai_insights()
        elif raw_path == '/test-suites':
            if http_method == 'GET': return handle_get_test_suites()
            if http_method == 'POST': return handle_post_test_suites(body_data)
        elif raw_path.startswith('/test-suites/') and http_method == 'DELETE':
            return handle_delete_test_suites(raw_path.split('/test-suites/')[-1])
        elif raw_path.startswith('/test-suites/') and http_method == 'GET':
            return handle_get_test_suite_detail(raw_path.split('/test-suites/')[-1])
        elif raw_path == '/email-config':
            if http_method == 'GET': return handle_get_emails()
            if http_method == 'POST': return handle_post_emails(body_data)
        elif raw_path.startswith('/email-config/') and http_method == 'DELETE':
            return handle_delete_emails(raw_path.split('/email-config/')[-1])

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
                logger.warning(f"Truy cập bị từ chối. User groups: {groups}")
                return error(403, 'Forbidden: Bạn không có quyền chạy kiểm thử. Chỉ nhóm Admin hoặc QA mới được phép.')

        queue_url = os.environ['TASK_QUEUE_URL']
        
        body = {}
        if 'body' in event and event['body']:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
                
        if 'task_id' not in body:
            body['task_id'] = str(uuid.uuid4())
            
        if 'website' in body and 'target_url' not in body:
            body['target_url'] = body['website']
        if 'suite' in body and 'test_script' not in body:
            body['test_script'] = body['suite']
            
        logger.info(f"Prepared message for SQS: {json.dumps(body)}")
        
        response = sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(body)
        )
        
        logger.info(f"Message sent to SQS successfully, MessageId: {response['MessageId']}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Yêu cầu kiểm thử đã được tiếp nhận',
                'task_id': body['task_id'],
                'message_id': response['MessageId']
            })
        }
    except Exception as e:
        logger.error(f"Error processing API request: {str(e)}")
        return error(500, f"Đã có lỗi xảy ra trên server: {str(e)}")
