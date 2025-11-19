import json
import os
import uuid
import boto3
from urllib.parse import quote

s3 = boto3.client('s3')
BUCKET = os.environ.get('UPLOAD_BUCKET') or os.environ.get('BUCKET_NAME')
# Optionally allow overriding default prefix
PREFIX = os.environ.get('UPLOAD_PREFIX', 'uploads')

ALLOWED_EXT = {'.pdf', '.epub'}
MAX_SIZE = 50 * 1024 * 1024  # 50MB


def _response(status, body, headers=None):
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST'
    }
    if headers:
        cors.update(headers)
    return {
        'statusCode': status,
        'headers': cors,
        'body': json.dumps(body)
    }


def handler(event, context):
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return _response(200, {'ok': True})

    if not BUCKET:
        return _response(500, {'error': 'Bucket not configured'})

    try:
        body = event.get('body') or '{}'
        data = json.loads(body)
    except json.JSONDecodeError:
        return _response(400, {'error': 'Invalid JSON body'})

    required = ['title', 'author', 'fileName', 'fileSize']
    missing = [r for r in required if r not in data]
    if missing:
        return _response(400, {'error': f'Missing fields: {", ".join(missing)}'})

    file_name = data['fileName']
    file_size = int(data['fileSize'])
    ext = '.' + file_name.lower().split('.')[-1] if '.' in file_name else ''
    if ext not in ALLOWED_EXT:
        return _response(400, {'error': 'Unsupported file type'})
    if file_size > MAX_SIZE:
        return _response(400, {'error': 'File too large'})

    safe_name = quote(file_name.replace(' ', '_'))
    object_key = f"{PREFIX}/{uuid.uuid4()}-{safe_name}"

    # Generate presigned URL for PUT
    try:
        upload_url = s3.generate_presigned_url(
            ClientMethod='put_object',
            Params={
                'Bucket': BUCKET,
                'Key': object_key,
                'ContentType': data.get('contentType', 'application/octet-stream')
            },
            ExpiresIn=900  # 15 minutes
        )
    except Exception as e:
        return _response(500, {'error': f'Failed to generate URL: {str(e)}'})

    return _response(200, {
        'uploadUrl': upload_url,
        'objectKey': object_key
    })
