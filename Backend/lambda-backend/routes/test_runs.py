import os
from core.aws import dynamodb
from core.responses import success, error
from core.utils import format_run_history_item

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
            detail_response = {
                'runDetail': formatted,
                'testCases': [],
                'logs': []
            }
            return success(detail_response)
            
        response = table.scan()
        items = response.get('Items', [])
        items.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        mapped_items = [format_run_history_item(i) for i in items]
        return success(mapped_items)
    except Exception as e:
        return error(500, str(e))
