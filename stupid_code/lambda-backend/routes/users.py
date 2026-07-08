import os
import uuid
from core.aws import cognito, dynamodb, logger
from core.responses import success, error

def handle_get_users():
    try:
        user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')
        if not user_pool_id:
            return error(500, 'Thiếu biến môi trường COGNITO_USER_POOL_ID')
        
        response = cognito.list_users(UserPoolId=user_pool_id)
        users = []
        for u in response.get('Users', []):
            attrs = {a['Name']: a['Value'] for a in u.get('Attributes', [])}
            email = attrs.get('email', '')
            name = attrs.get('name', email.split('@')[0] if email else 'Unknown')
            
            role = 'qa'
            try:
                group_res = cognito.admin_list_groups_for_user(UserPoolId=user_pool_id, Username=u['Username'])
                groups = group_res.get('Groups', [])
                if groups:
                    gn = groups[0].get('GroupName')
                    if gn == 'Admin': role = 'admin'
                    elif gn == 'QA': role = 'qa'
                    elif gn == 'Developer': role = 'developer'
            except Exception as e:
                logger.warning(f"Không thể lấy group cho user {email}: {str(e)}")
            
            status_map = {
                'CONFIRMED': 'active',
                'UNCONFIRMED': 'inactive',
                'FORCE_CHANGE_PASSWORD': 'active'
            }
            
            last_login = '—'
            if u.get('UserLastModifiedDate'):
                last_login = u['UserLastModifiedDate'].strftime('%Y-%m-%d %H:%M:%S')

            users.append({
                'id': u.get('Username'),
                'user_id': u.get('Username'),
                'name': name,
                'email': email,
                'role': role,
                'status': status_map.get(u.get('UserStatus'), 'active'),
                'lastLogin': last_login
            })
            
        return success(users)
    except Exception as e:
        logger.error(f"Error fetching users from Cognito: {str(e)}")
        return error(500, str(e))

def handle_post_users(body):
    try:
        email = body.get('email', '')
        name = body.get('name', '')
        role = body.get('role', 'qa')
        password = body.get('password', '')

        user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')
        if user_pool_id and email:
            try:
                cognito.admin_create_user(
                    UserPoolId=user_pool_id,
                    Username=email,
                    UserAttributes=[
                        {'Name': 'email', 'Value': email},
                        {'Name': 'email_verified', 'Value': 'true'},
                        {'Name': 'name', 'Value': name}
                    ],
                    MessageAction='SUPPRESS'
                )
                
                if password:
                    cognito.admin_set_user_password(
                        UserPoolId=user_pool_id,
                        Username=email,
                        Password=password,
                        Permanent=True
                    )
                    
                group_name = 'Admin' if role == 'admin' else ('QA' if role == 'qa' else 'Developer')
                cognito.admin_add_user_to_group(
                    UserPoolId=user_pool_id,
                    Username=email,
                    GroupName=group_name
                )
            except Exception as ce:
                logger.error(f"Lỗi khi tạo user trên Cognito: {str(ce)}")

        table_name = os.environ.get('USERS_TABLE', 'playwright-users')
        table = dynamodb.Table(table_name)
        user_id = str(uuid.uuid4())
        item = {
            'user_id': user_id,
            'name': name,
            'email': email,
            'role': role,
            'status': 'active',
            'lastLogin': '—'
        }
        table.put_item(Item=item)
        return success({'message': 'Tạo user thành công', 'user_id': user_id})
    except Exception as e:
        logger.error(f"Error creating user in DB: {str(e)}")
        return error(500, str(e))

def handle_delete_users(user_id):
    try:
        user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')
        if user_pool_id and user_id:
            cognito.admin_delete_user(
                UserPoolId=user_pool_id,
                Username=user_id
            )
        return success({'message': 'Đã xóa user thành công'})
    except Exception as e:
        return error(500, str(e))
