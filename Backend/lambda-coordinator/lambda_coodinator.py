import json
import os
import boto3
import logging
import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ecs = boto3.client('ecs')
dynamodb = boto3.client('dynamodb')

def lambda_handler(event, context):
    """
    Đọc message từ SQS:
    1. Ghi nhận trạng thái "running" vào DynamoDB Test History.
    2. Gọi ECS RunTask để chạy Playwright container.
    """
    try:
        logger.info(f"Received event from SQS: {json.dumps(event)}")
        
        cluster_name = os.environ['ECS_CLUSTER_NAME']
        task_definition = os.environ['ECS_TASK_DEFINITION']
        subnets = [s.strip() for s in os.environ['SUBNET_IDS'].split(',')]
        security_groups = [sg.strip() for sg in os.environ['SECURITY_GROUP_IDS'].split(',')]
        container_name = os.environ['CONTAINER_NAME']
        assign_public_ip = os.environ.get('ASSIGN_PUBLIC_IP', 'DISABLED')
        history_table = os.environ['TEST_HISTORY_TABLE']
        
        for record in event.get('Records', []):
            message_body = record['body']
            logger.info(f"Processing message body: {message_body}")
            
            payload = json.loads(message_body)
            task_id = payload.get('task_id')
            
            if not task_id:
                import uuid
                task_id = f"auto-cron-{str(uuid.uuid4())[:8]}"
                payload['task_id'] = task_id
                logger.info(f"Generated dynamic task_id for EventBridge/SQS payload: {task_id}")
            
            # Đảm bảo payload truyền vào ECS container có cả script_s3_key
            # để container tự fetch nội dung script từ S3
            if 'script_s3_key' not in payload and payload.get('test_script', '').startswith('test-scripts/'):
                payload['script_s3_key'] = payload['test_script']

            env_vars = [
                {
                    'name': 'TASK_PAYLOAD',
                    'value': json.dumps(payload)
                }
            ]
            
            logger.info(f"Calling ECS RunTask on cluster {cluster_name}")
            response = ecs.run_task(
                cluster=cluster_name,
                taskDefinition=task_definition,
                launchType='FARGATE',
                networkConfiguration={
                    'awsvpcConfiguration': {
                        'subnets': subnets,
                        'securityGroups': security_groups,
                        'assignPublicIp': assign_public_ip
                    }
                },
                overrides={
                    'containerOverrides': [
                        {
                            'name': container_name,
                            'environment': env_vars
                        }
                    ]
                }
            )
            
            logger.info(f"ECS RunTask response: {json.dumps(response, default=str)}")
            
            if response.get('failures'):
                logger.error(f"ECS Task failures: {response['failures']}")
                raise Exception(f"Failed to run ECS task: {response['failures']}")
                
            logger.info(f"Writing running status to DynamoDB {history_table} for task {task_id}")

            # script_s3_key: S3 path (để container fetch nội dung thực)
            # test_script  : tên hiển thị ngắn (tên file hoặc tên suite)
            script_s3_key = payload.get('script_s3_key', '')
            test_script_display = payload.get('test_script', '')
            if test_script_display.startswith('test-scripts/'):
                # Nếu vẫn là S3 key (legacy), tách ra tên file để display
                test_script_display = test_script_display.split('/')[-1]
                if not script_s3_key:
                    script_s3_key = payload.get('test_script', '')

            history_item = {
                'task_id':        {'S': task_id},
                'target_url':     {'S': payload.get('target_url', '')},
                'test_script':    {'S': test_script_display},   # Tên hiển thị
                'script_s3_key':  {'S': script_s3_key},         # S3 key để container fetch
                'status':         {'S': 'running'},
                'triggered_by':   {'S': payload.get('triggered_by', 'manual')},
                'started_at':     {'S': datetime.datetime.utcnow().isoformat() + 'Z'}
            }

            # Lưu thêm suite_name nếu có (dùng để hiển thị ở Dashboard)
            if payload.get('suite_name'):
                history_item['suite_name'] = {'S': payload['suite_name']}

            dynamodb.put_item(TableName=history_table, Item=history_item)
                
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Processed SQS messages and started ECS tasks successfully'})
        }
        
    except Exception as e:
        logger.error(f"Error in coordinator lambda: {str(e)}")
        raise e