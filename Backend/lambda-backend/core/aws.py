import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
scheduler = boto3.client('scheduler')
cognito = boto3.client('cognito-idp')
logs_client = boto3.client('logs')
