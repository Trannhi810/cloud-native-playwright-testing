import json

def success(body_dict):
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(body_dict, ensure_ascii=False, default=str)
    }

def error(status_code, error_msg):
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': str(error_msg)}, ensure_ascii=False, default=str)
    }

def error_message(status_code, message, error_details=None):
    body = {'message': message}
    if error_details:
        body['error'] = str(error_details)
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(body, ensure_ascii=False, default=str)
    }
