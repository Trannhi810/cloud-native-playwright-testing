import os
import datetime
from core.aws import dynamodb, logs_client, logger
from core.responses import success, error
from core.utils import format_run_history_item

def _get_cloudwatch_logs_and_cases(task_arn):
    logs_arr = []
    test_cases = []
    
    if not task_arn:
        return logs_arr, test_cases
        
    try:
        log_group = os.environ.get('LOG_GROUP_NAME', '/ecs/playwright-runner')
        task_id_short = task_arn.split('/')[-1]
        log_stream_name = f"ecs/playwright-container/{task_id_short}"
        
        response = logs_client.get_log_events(
            logGroupName=log_group,
            logStreamName=log_stream_name,
            limit=500,
            startFromHead=True
        )
        
        for event in response.get('events', []):
            msg = event.get('message', '')
            timestamp = event.get('timestamp', 0)
            
            level = 'INFO'
            if 'FAIL' in msg or 'Error' in msg or 'failed' in msg.lower():
                level = 'FAIL'
            elif 'PASS' in msg or 'success' in msg.lower():
                level = 'PASS'
                
            time_str = datetime.datetime.utcfromtimestamp(timestamp/1000).strftime('%H:%M:%S')
            logs_arr.append({
                'time': time_str,
                'level': level,
                'msg': msg.strip()
            })
            
            if "✓" in msg or "PASS" in msg:
                test_cases.append({
                    "id": str(len(test_cases)),
                    "name": msg.replace("✓", "").strip(),
                    "status": "pass",
                    "duration": "N/A"
                })
            elif "✖" in msg or "FAIL" in msg:
                test_cases.append({
                    "id": str(len(test_cases)),
                    "name": msg.replace("✖", "").strip(),
                    "status": "fail",
                    "duration": "N/A",
                    "error": "Failed during execution"
                })
                
    except Exception as e:
        logger.warning(f"Could not fetch logs for {task_arn}: {str(e)}")
        
    return logs_arr, test_cases

def handle_get_test_runs(run_id=None):
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return error(500, 'Thiếu biến môi trường TEST_HISTORY_TABLE')
            
        table = dynamodb.Table(table_name)
        if run_id:
            response = table.get_item(Key={'task_id': run_id})
            item = response.get('Item', {})
            formatted = format_run_history_item(item)
            
            task_arn = item.get('task_arn', '')
            logs_arr, test_cases = _get_cloudwatch_logs_and_cases(task_arn)
            
            detail_response = {
                'runDetail': formatted,
                'testCases': test_cases,
                'logs': logs_arr
            }
            return success(detail_response)
            
        response = table.scan()
        items = response.get('Items', [])
        items.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        mapped_items = [format_run_history_item(i) for i in items]
        return success(mapped_items)
    except Exception as e:
        return error(500, str(e))
