import sys
from pathlib import Path

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from cognito_pre_token.handler import handler


def test_groups_added_to_claims():
    event = {
        "request": {
            "userAttributes": {
                "sub": "user-123",
                "email": "user@example.com",
                "cognito:groups": "Admins,Editors",
            }
        },
        "response": {},
    }

    result = handler(event, context={})
    claims = result["response"]["claimsOverrideDetails"]

    assert claims["groupOverrideDetails"]["groupsToOverride"] == ["Admins", "Editors"]


def test_groups_from_group_configuration():
    event = {
        "request": {
            "groupConfiguration": {
                "groupsToOverride": ["Admins", "Auditors"],
            },
            "userAttributes": {
                "sub": "user-123",
                "email": "user@example.com",
            },
        },
        "response": {},
    }

    result = handler(event, context={})
    claims = result["response"]["claimsOverrideDetails"]

    assert claims["groupOverrideDetails"]["groupsToOverride"] == ["Admins", "Auditors"]


def test_handles_none_response():
    event = {
        "request": {
            "groupConfiguration": {
                "groupsToOverride": ["Admins"],
            },
            "userAttributes": {
                "sub": "user-123",
            },
        },
        "response": None,
    }

    result = handler(event, context={})
    claims = result["response"]["claimsOverrideDetails"]

    assert claims["groupOverrideDetails"]["groupsToOverride"] == ["Admins"]
