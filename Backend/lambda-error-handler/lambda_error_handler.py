import json
import os
import boto3
import logging
import datetime
import uuid

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.client('dynamodb')

def lambda_handler(event, context):
    """
    Đọc message từ SQS Dead Letter Queue (DLQ):
    1. Ghi nhận lỗi vào bảng playwright-error-log.
    2. Cập nhật trạng thái "failed" vào bảng playwright-test-history.
    """
    try:
        logger.info(f"Received event from DLQ: {json.dumps(event)}")
        
        error_table = os.environ['ERROR_DYNAMODB_TABLE']
        history_table = os.environ['TEST_HISTORY_TABLE']
        
        for record in event.get('Records', []):
            message_body = record['body']
            message_id = record['messageId']
            logger.info(f"Processing DLQ message: {message_body}")
            
            item = {
                'error_id': {'S': str(uuid.uuid4())},
                'original_message_id': {'S': message_id},
                'message_body': {'S': message_body},
                'timestamp': {'S': datetime.datetime.utcnow().isoformat() + 'Z'},
            }
            
            error_msg = "Unknown error (DLQ Triggered)"
            if 'messageAttributes' in record and 'ErrorMessage' in record['messageAttributes']:
                error_msg = record['messageAttributes']['ErrorMessage']['stringValue']
            item['error_message'] = {'S': error_msg}
                
            logger.info(f"Writing error log to table {error_table}")
            dynamodb.put_item(
                TableName=error_table,
                Item=item
            )
            
            task_id = None
            try:
                payload = json.loads(message_body)
                task_id = payload.get('task_id')
            except Exception as parse_err:
                logger.error(f"Failed to parse task_id from DLQ message body: {str(parse_err)}")
                
            if task_id:
                logger.info(f"Updating status to failed in {history_table} for task {task_id}")
                try:
                    dynamodb.update_item(
                        TableName=history_table,
                        Key={'task_id': {'S': task_id}},
                        UpdateExpression="SET #s = :status, finished_at = :finished, ai_summary = :ai_sum",
                        ExpressionAttributeNames={'#s': 'status'},
                        ExpressionAttributeValues={
                            ':status': {'S': 'failed'},
                            ':finished': {'S': datetime.datetime.utcnow().isoformat() + 'Z'},
                            ':ai_sum': {'S': f"System Error: {error_msg}"}
                        }
                    )
                except Exception as db_err:
                    logger.error(f"Failed to update test history for task {task_id}: {str(db_err)}")
            
            logger.info(f"Successfully processed DLQ message {message_id}")
            
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Errors logged and task history updated successfully'})
        }
        
    except Exception as e:
        logger.error(f"Failed to process DLQ event: {str(e)}")
        raise e