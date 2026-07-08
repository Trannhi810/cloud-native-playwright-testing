import re
import json

with open('stupid_code/lambda-backend/lambda_backend.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to match: return {'statusCode': 500, 'body': ...}
# Allowing for newlines and spaces
pattern = r"return\s*\{\s*'statusCode'\s*:\s*500\s*,\s*'body'\s*:\s*(.*?)\s*\}"
replacement = r"return {'statusCode': 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': \1}"

new_content = re.sub(pattern, replacement, content)

with open('stupid_code/lambda-backend/lambda_backend.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done replacing!")
