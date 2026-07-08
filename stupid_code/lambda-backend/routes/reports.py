import os
from boto3.dynamodb.conditions import Attr
from core.aws import dynamodb, logger
from core.responses import success, error
from core.utils import format_run_history_item

def handle_get_reports():
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return error(500, 'Thiếu biến môi trường TEST_HISTORY_TABLE')
            
        table = dynamodb.Table(table_name)
        response = table.scan(
            FilterExpression=Attr('status').eq('success') & Attr('report_url').exists()
        )
        items = response.get('Items', [])
        items.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        return success(items)
    except Exception as e:
        logger.error(f"Error fetching reports: {str(e)}")
        return error(500, f"Lỗi server: {str(e)}")

def handle_get_report_detail(report_id):
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        table = dynamodb.Table(table_name)
        response = table.get_item(Key={'task_id': report_id})
        item = response.get('Item', {})
        if not item:
            return error(404, 'Không tìm thấy báo cáo')
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
        return success(report)
    except Exception as e:
        return error(500, str(e))
