import os
import json
import uuid
from core.aws import scheduler, logger
from core.responses import success, error

def handle_get_schedules():
    try:
        response = scheduler.list_schedules()
        schedules_raw = response.get('Schedules', [])
        
        schedules = []
        for s in schedules_raw:
            name = s.get('Name')
            try:
                detail = scheduler.get_schedule(Name=name)
                state = detail.get('State', 'DISABLED')
                expr = detail.get('ScheduleExpression', '')
                
                cron_str = expr.replace('cron(', '').replace(')', '')
                parts = cron_str.split()
                if len(parts) == 6:
                    parts = [p if p != '?' else '*' for p in parts[:5]]
                    cron_str = ' '.join(parts)
                
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
        
        return success(schedules)
    except Exception as e:
        logger.error(f"Error fetching schedules: {str(e)}")
        return error(500, f"Lỗi server, hãy đảm bảo Lambda có quyền scheduler:ListSchedules: {str(e)}")

def handle_post_schedules(body):
    try:
        name = body.get('name', f'schedule-{uuid.uuid4()}')
        cron = body.get('cron', '0 2 * * *')
        parts = cron.strip().split()
        
        if len(parts) == 5:
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
            parts_url = queue_url.replace('https://sqs.', '').split('/')
            if len(parts_url) >= 3:
                region = parts_url[0].split('.')[0]
                queue_arn = f"arn:aws:sqs:{region}:{parts_url[1]}:{parts_url[2]}"
                
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
        return success({'message': 'Tạo lịch thành công', 'name': name})
    except Exception as e:
        return error(500, str(e))

def handle_delete_schedules(schedule_id):
    try:
        scheduler.delete_schedule(Name=schedule_id)
        return success({'message': f'Đã xóa lịch {schedule_id}'})
    except Exception as e:
        return error(500, str(e))
