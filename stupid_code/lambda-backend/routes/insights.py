from core.responses import success

def handle_get_audit_logs():
    return success([])

def handle_get_ai_insights():
    return success({'summary': 'Chưa có dữ liệu phân tích.'})
