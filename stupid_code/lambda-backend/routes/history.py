import os
from core.aws import dynamodb, logger
from core.responses import success, error
from core.utils import format_run_history_item

def handle_get_history():
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return error(500, 'Thiếu biến môi trường TEST_HISTORY_TABLE')
            
        table = dynamodb.Table(table_name)
        response = table.scan()
        items = response.get('Items', [])

        items.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        return success(items)
    except Exception as e:
        logger.error(f"Error fetching history: {str(e)}")
        return error(500, f"Lỗi server: {str(e)}")

def handle_get_stats():
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return error(500, 'Thiếu biến môi trường TEST_HISTORY_TABLE')
            
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
        
        return success({
            'stats': stats,
            'pieData': pie_data,
            'trendData': [],
            'recentRuns': [format_run_history_item(i) for i in recent]
        })
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        return error(500, str(e))
