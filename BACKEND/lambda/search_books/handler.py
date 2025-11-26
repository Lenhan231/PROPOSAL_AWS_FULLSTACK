import json

def handler(event, context):
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "dummy OK",
            "path": event.get("rawPath"),
            "stage": event.get("requestContext", {}).get("stage", None),
        })
    }
