import os
from core.aws import dynamodb
from core.responses import success, error

def handle_get_emails():
    try:
        table_name = os.environ.get('EMAIL_CONFIG_TABLE')
        if not table_name:
            return error(500, 'Thiếu biến môi trường EMAIL_CONFIG_TABLE')
            
        table = dynamodb.Table(table_name)
        response = table.scan()
        return success(response.get('Items', []))
    except Exception as e:
        return error(500, str(e))

def handle_post_emails(body):
    try:
        table_name = os.environ.get('EMAIL_CONFIG_TABLE')
        table = dynamodb.Table(table_name)
        
        email_address = body.get('email_address')
        if not email_address:
            return error(400, 'Thiếu email_address')
            
        item = {
            'email_address': email_address,
            'active': body.get('active', True)
        }
        table.put_item(Item=item)
        return success({'message': 'Thêm email thành công'})
    except Exception as e:
        return error(500, str(e))

def handle_delete_emails(email_address):
    try:
        table_name = os.environ.get('EMAIL_CONFIG_TABLE')
        table = dynamodb.Table(table_name)
        table.delete_item(Key={'email_address': email_address})
        return success({'message': 'Đã xóa email'})
    except Exception as e:
        return error(500, str(e))
