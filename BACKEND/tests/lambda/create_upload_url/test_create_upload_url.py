import json

import boto3

from create_upload_url.handler import handler

from utils.error_codes import ErrorCode

def test_create_upload_url_happy_path(upload_test_context):
    region = upload_test_context["region"]
    table_name = upload_test_context["table_name"]

    event = {
        "requestContext": {
            "authorizer": {
                "jwt": {
                    "claims": {
                        "sub": "user-123",
                        "email": "user@example.com",
                    }
                }
            }
        },
        "body": json.dumps(
            {
                "fileName": "book.pdf",
                "fileSize": 1024,
                "title": "AWS Serverless Guide",
                "author": "John Doe",
                "description": "Test book",
            }
        ),
    }

    response = handler(event, context={})

    assert response["statusCode"] == 200

    body = json.loads(response["body"])
    assert "uploadUrl" in body
    assert body["expiresIn"] == 900
    assert body["bookId"]

    ddb_resource = boto3.resource("dynamodb", region_name=region)
    table = ddb_resource.Table(table_name)

    item = table.get_item(
        Key={"PK": f"BOOK#{body['bookId']}", "SK": "METADATA"}
    ).get("Item")

    assert item is not None
    assert item["status"] == "UPLOADING"
    assert item["uploaderId"] == "user-123"
    assert item["GSI6PK"] == "UPLOADER#user-123"
    assert item["GSI6SK"] == f"BOOK#{body['bookId']}"
    assert item["s3Key"].startswith(f"uploads/{body['bookId']}/")
