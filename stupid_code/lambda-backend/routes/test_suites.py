import os
import uuid
import datetime
from core.aws import dynamodb, s3, logger
from core.responses import success, error

def handle_get_test_suites():
    try:
        table_name = os.environ.get('TEST_SUITES_TABLE')
        if not table_name:
            return error(500, 'Thiếu biến môi trường TEST_SUITES_TABLE')
            
        table = dynamodb.Table(table_name)
        response = table.scan()
        
        mapped_suites = []
        for item in response.get('Items', []):
            script_key = item.get('script_s3_key', '')
            script_display = script_key.split('/')[-1] if script_key else ''

            mapped_suites.append({
                'id': item.get('suite_id', ''),
                'name': item.get('name', script_display or 'Untitled Suite'),
                'website': item.get('target_url', ''),
                'description': item.get('description', 'Không có mô tả'),
                'cases': int(item.get('cases', 0)),
                'size': item.get('script_size', 'Unknown'),
                'updatedAt': item.get('updated_at', 'N/A'),
                'status': item.get('status', 'active'),
                'script_s3_key': script_key
            })
            
        return success(mapped_suites)
    except Exception as e:
        logger.error(f"Error fetching test suites: {str(e)}")
        return error(500, str(e))

def handle_post_test_suites(body):
    try:
        table_name = os.environ.get('TEST_SUITES_TABLE')
        report_bucket = os.environ.get('REPORT_BUCKET')
        table = dynamodb.Table(table_name)

        suite_id = body.get('suite_id') or str(uuid.uuid4())
        test_script_content = body.get('test_script', '')

        script_s3_key = None
        script_size = '—'
        if not report_bucket:
            logger.warning("[POST /test-suites] Bỏ qua upload S3: biến môi trường REPORT_BUCKET chưa được set!")
        elif not test_script_content:
            logger.warning("[POST /test-suites] Bỏ qua upload S3: Frontend không gửi nội dung test_script (rỗng).")
        else:
            script_s3_key = f"test-scripts/{suite_id}.js"
            script_bytes = test_script_content.encode('utf-8')
            script_size = f"{len(script_bytes) / 1024:.1f} KB"
            s3.put_object(
                Bucket=report_bucket,
                Key=script_s3_key,
                Body=script_bytes,
                ContentType='application/javascript'
            )
            logger.info(f"[POST /test-suites] ✅ Uploaded test script to s3://{report_bucket}/{script_s3_key} ({script_size})")

        item = {
            'suite_id': suite_id,
            'name': body.get('name', 'Untitled Suite'),
            'target_url': body.get('target_url', ''),
            'description': body.get('description', ''),
            'script_s3_key': script_s3_key or '',
            'test_script': script_s3_key.split('/')[-1] if script_s3_key else (body.get('name', 'Untitled Suite')),
            'script_size': script_size,
            'updated_at': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M'),
            'status': 'active',
            'cases': int(body.get('cases', 0))
        }
        table.put_item(Item=item)
        return success({
            'message': 'Tạo Test Suite thành công',
            'suite_id': suite_id,
            'script_s3_key': script_s3_key
        })
    except Exception as e:
        logger.error(f"Error creating test suite: {str(e)}")
        return error(500, str(e))

def handle_get_test_suite_detail(suite_id):
    try:
        table_name = os.environ.get('TEST_SUITES_TABLE')
        report_bucket = os.environ.get('REPORT_BUCKET')
        table = dynamodb.Table(table_name)

        response = table.get_item(Key={'suite_id': suite_id})
        item = response.get('Item')
        if not item:
            return error(404, 'Không tìm thấy test suite')

        script_content = ''
        script_s3_key = item.get('script_s3_key', '')
        if script_s3_key and report_bucket:
            try:
                obj = s3.get_object(Bucket=report_bucket, Key=script_s3_key)
                script_content = obj['Body'].read().decode('utf-8')
            except Exception as s3_err:
                logger.warning(f"Could not read script from S3 ({script_s3_key}): {str(s3_err)}")

        return success({
            'id': item.get('suite_id', ''),
            'name': item.get('name', ''),
            'website': item.get('target_url', ''),
            'description': item.get('description', ''),
            'script_s3_key': script_s3_key,
            'test_script': script_content
        })
    except Exception as e:
        logger.error(f"Error fetching test suite detail: {str(e)}")
        return error(500, str(e))

def handle_delete_test_suites(suite_id):
    try:
        table_name = os.environ.get('TEST_SUITES_TABLE')
        report_bucket = os.environ.get('REPORT_BUCKET')
        table = dynamodb.Table(table_name)

        if report_bucket:
            try:
                response = table.get_item(Key={'suite_id': suite_id})
                item = response.get('Item', {})
                script_s3_key = item.get('script_s3_key') or f"test-scripts/{suite_id}.js"
                s3.delete_object(Bucket=report_bucket, Key=script_s3_key)
                logger.info(f"Deleted test script from s3://{report_bucket}/{script_s3_key}")
            except Exception as s3_err:
                logger.warning(f"Could not delete test script from S3: {str(s3_err)}")

        table.delete_item(Key={'suite_id': suite_id})
        return success({'message': 'Đã xóa test suite'})
    except Exception as e:
        return error(500, str(e))
