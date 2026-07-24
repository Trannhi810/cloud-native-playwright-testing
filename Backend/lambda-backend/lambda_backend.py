import json
import os
import boto3
import logging
import uuid
import datetime
from boto3.dynamodb.conditions import Attr

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
scheduler = boto3.client('scheduler')
cognito = boto3.client('cognito-idp')

def handle_get_history():
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'Thiếu biến môi trường TEST_HISTORY_TABLE'})}
            
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
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'Lỗi server', 'error': str(e)})}

def handle_get_reports():
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'Thiếu biến môi trường TEST_HISTORY_TABLE'})}
            
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
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'Lỗi server', 'error': str(e)})}

def handle_get_schedules():
    try:
        response = scheduler.list_schedules()
        schedules_raw = response.get('Schedules', [])
        
        schedules = []
        for s in schedules_raw:
            name = s.get('Name')
            # Lấy chi tiết từng schedule để có cron và input
            try:
                detail = scheduler.get_schedule(Name=name)
                state = detail.get('State', 'DISABLED')
                expr = detail.get('ScheduleExpression', '')
                
                # Bóc tách cron(0 2 * * ? *) -> 0 2 * * *
                cron_str = expr.replace('cron(', '').replace(')', '')
                parts = cron_str.split()
                if len(parts) == 6:
                    # Chuyển ? thành * và bỏ field year
                    parts = [p if p != '?' else '*' for p in parts[:5]]
                    cron_str = ' '.join(parts)
                
                # Parse Input
                target = detail.get('Target', {})
                input_str = target.get('Input', '{}')
                input_data = json.loads(input_str)
                
                schedules.append({
                    'id': name,
                    'name': name,
                    'website': input_data.get('website', 'N/A'),
                    'env': input_data.get('env', 'Production'),
                    'cron': cron_str,
                    'humanCron': f'Cron expression: {cron_str}',
                    'status': 'active' if state == 'ENABLED' else 'inactive',
                    'lastRun': '—',
                    'nextRun': '—'
                })
            except Exception as e:
                logger.warning(f"Failed to get details for schedule {name}: {str(e)}")
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(schedules, default=str, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error fetching schedules: {str(e)}")
        return {
            'statusCode': 500, 
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Lỗi server, hãy đảm bảo Lambda có quyền scheduler:ListSchedules', 'error': str(e)}, ensure_ascii=False)
        }

def handle_get_test_suites():
    try:
        table_name = os.environ.get('TEST_SUITES_TABLE')
        if not table_name:
            return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'Thiếu biến môi trường TEST_SUITES_TABLE'})}
            
        table = dynamodb.Table(table_name)
        response = table.scan()
        
        mapped_suites = []
        for item in response.get('Items', []):
            # script_s3_key dạng "test-scripts/uuid.js" → dùng làm display name nếu không có name riêng
            script_key = item.get('script_s3_key', '')
            script_display = script_key.split('/')[-1] if script_key else ''

            mapped_suites.append({
                'id': item.get('suite_id', ''),           # suite_id → id (Frontend dùng suite.id)
                'name': item.get('name', script_display or 'Untitled Suite'),
                'website': item.get('target_url', ''),    # target_url → website
                'description': item.get('description', 'Không có mô tả'),
                'cases': int(item.get('cases', 0)),        # số test cases (nếu có lưu)
                'size': item.get('script_size', 'Unknown'),
                'updatedAt': item.get('updated_at', 'N/A'),  # updated_at → updatedAt
                'status': item.get('status', 'active'),
                'script_s3_key': script_key
            })
            
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(mapped_suites, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error fetching test suites: {str(e)}")
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'Lỗi server', 'error': str(e)})}

def handle_post_test_suites(body):
    try:
        table_name = os.environ.get('TEST_SUITES_TABLE')
        report_bucket = os.environ.get('REPORT_BUCKET')
        table = dynamodb.Table(table_name)

        suite_id = body.get('suite_id') or str(uuid.uuid4())
        test_script_content = body.get('test_script', '')

        # --- Debug log để xác định nguyên nhân nếu upload bị bỏ qua ---
        logger.info(f"[POST /test-suites] suite_id={suite_id}")
        logger.info(f"[POST /test-suites] REPORT_BUCKET env = '{report_bucket}'")
        logger.info(f"[POST /test-suites] test_script_content length = {len(test_script_content)}")

        # Upload kịch bản test lên S3 với prefix test-scripts/
        # S3 KHÔNG cần tạo prefix trước — put_object tự tạo "folder" khi upload
        script_s3_key = None
        script_size = '—'
        if not report_bucket:
            logger.warning("[POST /test-suites] Bỏ qua upload S3: biến môi trường REPORT_BUCKET chưa được set!")
        elif not test_script_content:
            logger.warning("[POST /test-suites] Bỏ qua upload S3: Frontend không gửi nội dung test_script (rỗng).")
        else:
            script_s3_key = f"test-scripts/{suite_id}.js"
            script_bytes = test_script_content.encode('utf-8')
            script_size = f"{len(script_bytes) / 1024:.1f} KB"   # Tính size để lưu vào DynamoDB
            s3.put_object(
                Bucket=report_bucket,
                Key=script_s3_key,
                Body=script_bytes,
                ContentType='application/javascript'
            )
            logger.info(f"[POST /test-suites] ✅ Uploaded test script to s3://{report_bucket}/{script_s3_key} ({script_size})")

        item = {
            'suite_id': suite_id,
            'name': body.get('name', 'Untitled Suite'),
            'target_url': body.get('target_url', ''),
            'description': body.get('description', ''),
            'script_s3_key': script_s3_key or '',
            'test_script': script_s3_key.split('/')[-1] if script_s3_key else (body.get('name', 'Untitled Suite')),
            'script_size': script_size,                          # ✅ Lưu size để GET trả về đúng
            'updated_at': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M'),
            'status': 'active',
            'cases': int(body.get('cases', 0))
        }
        table.put_item(Item=item)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'message': 'Tạo Test Suite thành công',
                'suite_id': suite_id,
                'script_s3_key': script_s3_key
            }, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error creating test suite: {str(e)}")
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}

def handle_get_emails():
    try:
        table_name = os.environ.get('EMAIL_CONFIG_TABLE')
        if not table_name:
            return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'Thiếu biến môi trường EMAIL_CONFIG_TABLE'})}
            
        table = dynamodb.Table(table_name)
        response = table.scan()
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(response.get('Items', []), ensure_ascii=False)
        }
    except Exception as e:
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}

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
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}

def handle_get_stats():
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'Thiếu biến môi trường TEST_HISTORY_TABLE'})}
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
                # recentRuns phải được format đúng để QADashboard dùng s.name, s.cases
                'recentRuns': [format_run_history_item(i) for i in recent]
            }, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}

def format_run_history_item(item):
    task_id = item.get('task_id', '')
    status_db = item.get('status', 'running')
    # Map DB status → Frontend status (pass/fail/running)
    status_fe = 'pass' if status_db == 'success' else ('fail' if status_db == 'failed' else 'running')

    started_at = item.get('started_at', '')
    finished_at = item.get('finished_at', '')
    duration = "N/A"
    if started_at and finished_at:
        try:
            start_dt = datetime.datetime.fromisoformat(started_at.replace('Z', '+00:00'))
            end_dt = datetime.datetime.fromisoformat(finished_at.replace('Z', '+00:00'))
            diff = end_dt - start_dt
            seconds = int(diff.total_seconds())
            mins, secs = divmod(seconds, 60)
            duration = f"{mins}m {secs}s"
        except Exception:
            pass

    # Format "2026-07-08 14:30:00" từ ISO timestamp
    time_fe = started_at[:10] + " " + started_at[11:19] if started_at else ""

    # suite: ưu tiên suite_name (tên dễ đọc), fallback test_script (S3 key / tên file)
    suite_display = item.get('suite_name') or item.get('test_script') or 'Default Suite'
    # Nếu là S3 key dạng "test-scripts/abc.js" → lấy phần tên file thôi
    if suite_display.startswith('test-scripts/'):
        suite_display = suite_display.split('/')[-1]

    # pass/fail/total: lấy từ DB nếu có (postprocessing có thể ghi vào), fallback theo status
    total_cases = int(item.get('total_cases', 1))
    pass_cases  = int(item.get('pass_cases',  1 if status_db == 'success' else 0))
    fail_cases  = int(item.get('fail_cases',  1 if status_db == 'failed'  else 0))

    return {
        'id': task_id[:8] if task_id else '',       # ID rút gọn để hiển thị
        'full_id': task_id,                          # UUID đầy đủ để navigate
        'website': item.get('target_url', ''),       # target_url → website
        'suite': suite_display,                      # tên kịch bản test
        'env': item.get('env', 'Production'),
        'status': status_fe,                         # 'success'/'failed' → 'pass'/'fail'/'running'
        'pass': pass_cases,
        'fail': fail_cases,
        'total': total_cases,
        'duration': duration,
        'trigger': item.get('triggered_by', 'manual'),
        'triggeredBy': item.get('triggered_by_user', 'Admin'),
        'time': time_fe,                             # started_at → time (định dạng đọc được)
        'aiSummary': item.get('ai_summary', ''),
        'startTime': started_at,
        'endTime': finished_at
    }

def handle_get_test_runs(run_id=None):
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'message': 'Thiếu biến môi trường TEST_HISTORY_TABLE'})}
        table = dynamodb.Table(table_name)
        if run_id:
            response = table.get_item(Key={'task_id': run_id})
            item = response.get('Item', {})
            formatted = format_run_history_item(item)
            detail_response = {
                'runDetail': formatted,
                'testCases': [],
                'logs': []
            }
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(detail_response, ensure_ascii=False)
            }
        response = table.scan()
        items = response.get('Items', [])
        items.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        mapped_items = [format_run_history_item(i) for i in items]
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(mapped_items, ensure_ascii=False)
        }
    except Exception as e:
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}

def handle_get_users():
    try:
        user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')
        if not user_pool_id:
            return {
                'statusCode': 500, 
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'Thiếu biến môi trường COGNITO_USER_POOL_ID'})
            }
        
        response = cognito.list_users(UserPoolId=user_pool_id)
        users = []
        for u in response.get('Users', []):
            attrs = {a['Name']: a['Value'] for a in u.get('Attributes', [])}
            email = attrs.get('email', '')
            # Parse name
            name = attrs.get('name', email.split('@')[0] if email else 'Unknown')
            
            # Lấy Group để set role chính xác
            role = 'qa'
            try:
                group_res = cognito.admin_list_groups_for_user(UserPoolId=user_pool_id, Username=u['Username'])
                groups = group_res.get('Groups', [])
                if groups:
                    gn = groups[0].get('GroupName')
                    if gn == 'Admin': role = 'admin'
                    elif gn == 'QA': role = 'qa'
                    elif gn == 'Developer': role = 'developer'
            except Exception as e:
                logger.warning(f"Không thể lấy group cho user {email}: {str(e)}")
            
            status_map = {
                'CONFIRMED': 'active',
                'UNCONFIRMED': 'inactive',
                'FORCE_CHANGE_PASSWORD': 'active'
            }
            
            # Format date nếu có
            last_login = '—'
            if u.get('UserLastModifiedDate'):
                last_login = u['UserLastModifiedDate'].strftime('%Y-%m-%d %H:%M:%S')

            users.append({
                'id': u.get('Username'),
                'user_id': u.get('Username'),
                'name': name,
                'email': email,
                'role': role,
                'status': status_map.get(u.get('UserStatus'), 'active'),
                'lastLogin': last_login
            })
            
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(users, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error fetching users from Cognito: {str(e)}")
        return {
            'statusCode': 500, 
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def handle_post_users(body):
    try:
        email = body.get('email', '')
        name = body.get('name', '')
        role = body.get('role', 'qa')
        password = body.get('password', '')

        user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')
        if user_pool_id and email:
            try:
                # Create user in Cognito
                cognito.admin_create_user(
                    UserPoolId=user_pool_id,
                    Username=email,
                    UserAttributes=[
                        {'Name': 'email', 'Value': email},
                        {'Name': 'email_verified', 'Value': 'true'},
                        {'Name': 'name', 'Value': name}
                    ],
                    MessageAction='SUPPRESS'
                )
                
                # Set password
                if password:
                    cognito.admin_set_user_password(
                        UserPoolId=user_pool_id,
                        Username=email,
                        Password=password,
                        Permanent=True
                    )
                    
                # Add user to Group
                group_name = 'Admin' if role == 'admin' else ('QA' if role == 'qa' else 'Developer')
                cognito.admin_add_user_to_group(
                    UserPoolId=user_pool_id,
                    Username=email,
                    GroupName=group_name
                )
            except Exception as ce:
                logger.error(f"Lỗi khi tạo user trên Cognito: {str(ce)}")
                # Tiếp tục lưu vào DB dù Cognito có lỗi (fallback cho mock/local)

        table_name = os.environ.get('USERS_TABLE', 'playwright-users')
        table = dynamodb.Table(table_name)
        user_id = str(uuid.uuid4())
        item = {
            'user_id': user_id,
            'name': name,
            'email': email,
            'role': role,
            'status': 'active',
            'lastLogin': '—'
        }
        table.put_item(Item=item)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Tạo user thành công', 'user_id': user_id}, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error creating user in DB: {str(e)}")
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}

def handle_delete_users(user_id):
    try:
        user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')
        if user_pool_id and user_id:
            cognito.admin_delete_user(
                UserPoolId=user_pool_id,
                Username=user_id
            )
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Đã xóa user thành công'}, ensure_ascii=False)
        }
    except Exception as e:
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}

def handle_post_schedules(body):
    try:
        name = body.get('name', f'schedule-{uuid.uuid4()}')
        cron = body.get('cron', '0 2 * * *')
        parts = cron.strip().split()
        
        if len(parts) == 5:
            # EventBridge Scheduler yêu cầu 6 field (thêm year).
            # Đặc biệt, Day-of-month (field 3) và Day-of-week (field 5) không được cùng là '*'
            # Một trong hai phải là '?'
            dom = parts[2]
            dow = parts[4]
            if dom == '*' and dow == '*':
                dow = '?'
            elif dom != '*' and dow == '*':
                dow = '?'
            elif dow != '*' and dom == '*':
                dom = '?'
            expr = f"cron({parts[0]} {parts[1]} {dom} {parts[3]} {dow} *)"
        else:
            expr = f"cron({cron} *)"
        queue_url = os.environ.get('TASK_QUEUE_URL', '')
        queue_arn = queue_url
        if queue_url.startswith('https://sqs.'):
            parts = queue_url.replace('https://sqs.', '').split('/')
            if len(parts) >= 3:
                region = parts[0].split('.')[0]
                queue_arn = f"arn:aws:sqs:{region}:{parts[1]}:{parts[2]}"
                
        scheduler.create_schedule(
            Name=name,
            ScheduleExpression=expr,
            FlexibleTimeWindow={'Mode': 'OFF'},
            Target={
                'Arn': queue_arn,
                'RoleArn': os.environ.get('SCHEDULER_ROLE_ARN', ''),
                'Input': json.dumps({'website': body.get('website', ''), 'env': body.get('env', 'Production')})
            }
        )
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Tạo lịch thành công', 'name': name}, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }

def handle_delete_schedules(schedule_id):
    try:
        scheduler.delete_schedule(Name=schedule_id)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': f'Đã xóa lịch {schedule_id}'}, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }

def handle_get_test_suite_detail(suite_id):
    """
    Lấy thông tin chi tiết 1 Test Suite, bao gồm nội dung script từ S3.
    Dùng khi Frontend cần hiển thị/chỉnh sửa kịch bản test.
    """
    try:
        table_name = os.environ.get('TEST_SUITES_TABLE')
        report_bucket = os.environ.get('REPORT_BUCKET')
        table = dynamodb.Table(table_name)

        response = table.get_item(Key={'suite_id': suite_id})
        item = response.get('Item')
        if not item:
            return {'statusCode': 404, 'body': json.dumps({'message': 'Không tìm thấy test suite'})}

        script_content = ''
        script_s3_key = item.get('script_s3_key', '')
        if script_s3_key and report_bucket:
            try:
                obj = s3.get_object(Bucket=report_bucket, Key=script_s3_key)
                script_content = obj['Body'].read().decode('utf-8')
            except Exception as s3_err:
                logger.warning(f"Could not read script from S3 ({script_s3_key}): {str(s3_err)}")

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'id': item.get('suite_id', ''),
                'name': item.get('name', ''),
                'website': item.get('target_url', ''),
                'description': item.get('description', ''),
                'script_s3_key': script_s3_key,
                'test_script': script_content
            }, ensure_ascii=False)
        }
    except Exception as e:
        logger.error(f"Error fetching test suite detail: {str(e)}")
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}


def handle_delete_test_suites(suite_id):
    try:
        table_name = os.environ.get('TEST_SUITES_TABLE')
        report_bucket = os.environ.get('REPORT_BUCKET')
        table = dynamodb.Table(table_name)

        # Lấy thông tin suite để biết key S3 cần xóa trước khi xóa record DynamoDB
        if report_bucket:
            try:
                response = table.get_item(Key={'suite_id': suite_id})
                item = response.get('Item', {})
                script_s3_key = item.get('script_s3_key') or f"test-scripts/{suite_id}.js"
                s3.delete_object(Bucket=report_bucket, Key=script_s3_key)
                logger.info(f"Deleted test script from s3://{report_bucket}/{script_s3_key}")
            except Exception as s3_err:
                # Không fail toàn bộ nếu xóa S3 thất bại (file có thể không tồn tại)
                logger.warning(f"Could not delete test script from S3: {str(s3_err)}")

        table.delete_item(Key={'suite_id': suite_id})
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Đã xóa test suite'}, ensure_ascii=False)
        }
    except Exception as e:
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}

def handle_delete_emails(email_address):
    try:
        table_name = os.environ.get('EMAIL_CONFIG_TABLE')
        table = dynamodb.Table(table_name)
        table.delete_item(Key={'email_address': email_address})
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Đã xóa email'}, ensure_ascii=False)
        }
    except Exception as e:
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}

def handle_get_report_detail(report_id):
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        table = dynamodb.Table(table_name)
        response = table.get_item(Key={'task_id': report_id})
        item = response.get('Item', {})
        if not item:
            return {'statusCode': 404, 'body': json.dumps({'message': 'Không tìm thấy báo cáo'})}
        fmt = format_run_history_item(item)
        report = {
            'title': f"Báo cáo {fmt['id']}",
            'subtitle': f"{fmt['website']} • {fmt['suite']}",
            'aiSummary': item.get('ai_summary', 'Chưa có phân tích AI.'),
            's3Link': item.get('report_url', ''),
            's3BucketPath': item.get('report_url', ''),
            'expiresAt': None,
            'summary': [
                ['Trạng thái', fmt['status']],
                ['Thời lượng', fmt['duration']],
                ['Website', fmt['website']],
                ['Kích hoạt', fmt['trigger']],
            ]
        }
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(report, ensure_ascii=False)
        }
    except Exception as e:
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': str(e)})}

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
    """
    Nhận request từ API Gateway và phân luồng (Routing) dựa trên đường dẫn.
    """
    try:
        logger.info(f"Received event from API Gateway: {json.dumps(event)}")
        raw_path = event.get('rawPath', '/trigger')
        http_method = event.get('requestContext', {}).get('http', {}).get('method', 'POST')
        
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
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'message': 'Forbidden: Bạn không có quyền chạy kiểm thử. Chỉ nhóm Admin hoặc QA mới được phép.'
                    }, ensure_ascii=False)
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
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Đã có lỗi xảy ra trên server',
                'error': str(e)
            }, ensure_ascii=False)
        }