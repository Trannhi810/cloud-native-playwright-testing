import os
import datetime
from core.aws import dynamodb, logger
from core.responses import success, error

def handle_get_audit_logs():
    return success([])

def handle_get_ai_insights():
    try:
        table_name = os.environ.get('TEST_HISTORY_TABLE')
        if not table_name:
            return error(500, 'Thiếu biến môi trường TEST_HISTORY_TABLE')
            
        table = dynamodb.Table(table_name)
        
        response = table.scan()
        items = response.get('Items', [])
        
        now = datetime.datetime.utcnow()
        recent_items = []
        
        for item in items:
            started_at_str = item.get('started_at', '')
            if started_at_str:
                try:
                    started_time = datetime.datetime.strptime(started_at_str[:19], '%Y-%m-%dT%H:%M:%S')
                    if (now - started_time).days <= 30:
                        recent_items.append(item)
                except Exception:
                    recent_items.append(item)
            else:
                recent_items.append(item)
                
        total_runs = len(recent_items)
        if total_runs == 0:
            return success({
                "totalRuns": 0,
                "avgPassRate": 0,
                "worstModule": "—",
                "repeatingErrors": 0,
                "repeatingErrorPatterns": [],
                "moduleScores": []
            })
            
        success_runs = sum(1 for i in recent_items if i.get('status') == 'success')
        avg_pass_rate = round((success_runs / total_runs) * 100, 1)
        
        module_stats = {}
        for item in recent_items:
            mod = item.get('test_script', 'Unknown')
            if mod not in module_stats:
                module_stats[mod] = {'total': 0, 'success': 0}
            module_stats[mod]['total'] += 1
            if item.get('status') == 'success':
                module_stats[mod]['success'] += 1
                
        module_scores = []
        worst_module = "—"
        lowest_score = 100
        
        for mod, stats in module_stats.items():
            score = round((stats['success'] / stats['total']) * 100, 1)
            module_scores.append({"name": mod, "score": score})
            if score < lowest_score:
                lowest_score = score
                worst_module = mod
                
        module_scores.sort(key=lambda x: x['score'], reverse=True)
        
        repeating_error_patterns = []
        repeating_errors = 0
        
        failed_items = [i for i in recent_items if i.get('status') == 'failed']
        if len(failed_items) > 0:
            failed_items.sort(key=lambda x: str(x.get('started_at') or ''), reverse=True)
            repeating_errors = 1
            last_seen = failed_items[0].get('started_at', '')[:10] if failed_items[0].get('started_at') else "Hôm nay"
            repeating_error_patterns = [
                {
                    "pattern": "Lỗi Backend Timeout / Bất đồng bộ",
                    "count": len(failed_items),
                    "lastSeen": last_seen
                }
            ]
            
        return success({
            "totalRuns": total_runs,
            "avgPassRate": avg_pass_rate,
            "worstModule": worst_module,
            "repeatingErrors": repeating_errors,
            "repeatingErrorPatterns": repeating_error_patterns,
            "moduleScores": module_scores
        })
        
    except Exception as e:
        logger.error(f"Error fetching AI insights: {str(e)}")
        return error(500, f"Lỗi server: {str(e)}")
