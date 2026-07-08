import datetime

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

    total_cases = int(item.get('total_cases', 1))
    pass_cases  = int(item.get('pass_cases',  1 if status_db == 'success' else 0))
    fail_cases  = int(item.get('fail_cases',  1 if status_db == 'failed'  else 0))

    return {
        'id': task_id[:8] if task_id else '',
        'full_id': task_id,
        'website': item.get('target_url', ''),
        'suite': suite_display,
        'env': item.get('env', 'Production'),
        'status': status_fe,
        'pass': pass_cases,
        'fail': fail_cases,
        'total': total_cases,
        'duration': duration,
        'trigger': item.get('triggered_by', 'manual'),
        'triggeredBy': item.get('triggered_by_user', 'Admin'),
        'time': time_fe,
        'aiSummary': item.get('ai_summary', ''),
        'startTime': started_at,
        'endTime': finished_at
    }
