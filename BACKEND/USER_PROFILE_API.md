# User Profile API Documentation

## Overview
The frontend authentication system integrates with a backend API for user profile management. This allows users to set custom display names that persist in DynamoDB, separate from AWS Cognito attributes.

## Required Endpoints

### 1. GET /user/profile
**Purpose:** Retrieve the current user's profile information

**Authentication:** Required - JWT Bearer token in Authorization header

**Request Headers:**
```
Authorization: Bearer <ID_TOKEN>
```

**Expected Response (200 OK):**
```json
{
  "user_id": "cognito-sub-uuid",
  "user_name": "John Doe",
  "email": "user@example.com",
  "created_at": "2024-12-01T10:00:00Z",
  "updated_at": "2024-12-02T15:30:00Z"
}
```

**Alternative Response Format (also supported):**
```json
{
  "profile": {
    "user_name": "John Doe",
    "email": "user@example.com"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: User profile not found (create default profile)
- `500 Internal Server Error`: Database error

**Notes:**
- The `user_name` field is the primary field used for display names
- If `user_name` is null/empty, frontend will fallback to Cognito email
- Frontend caches display name in localStorage to prevent flickering

---

### 2. PUT /user/profile
**Purpose:** Update the user's display name

**Authentication:** Required - JWT Bearer token in Authorization header

**Request Headers:**
```
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "user_name": "New Display Name"
}
```

**Expected Response (200 OK):**
```json
{
  "message": "Profile updated successfully",
  "user_name": "New Display Name"
}
```

**Error Responses:**
- `400 Bad Request`: Missing or invalid user_name
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Database error

**Validation Rules:**
- `user_name` should not be empty or whitespace-only
- Max length: 100 characters (recommended)
- No special validation required - allow Unicode, emojis, etc.

---

## Implementation Notes

### Token Extraction
Extract the user's Cognito `sub` (subject) from the JWT token:
```python
# Example using Python
import jwt

def get_user_id_from_token(token):
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get('sub')
    except Exception as e:
        raise Unauthorized("Invalid token")
```

### Database Schema (DynamoDB Example)
**Table Name:** `Users` or `UserProfiles`

**Primary Key:** `user_id` (String) - Cognito sub

**Attributes:**
```
user_id: String (PK)
user_name: String
email: String
created_at: String (ISO 8601)
updated_at: String (ISO 8601)
```

### Race Condition Handling
The frontend implements sequence counters to handle race conditions, but backend should also:
1. Use atomic updates for DynamoDB
2. Return the updated value in PUT response
3. Handle concurrent requests gracefully

### Profile Creation
If GET returns 404 (user doesn't exist):
- Frontend expects this on first login
- Backend should auto-create profile on first PUT request
- Or create default profile on first GET with empty user_name

### Example Lambda Handler (Python)
```python
import json
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('UserProfiles')

def lambda_handler(event, context):
    method = event['requestContext']['http']['method']
    user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    
    if method == 'GET':
        return get_profile(user_id)
    elif method == 'PUT':
        body = json.loads(event['body'])
        return update_profile(user_id, body.get('user_name'))
    
    return {
        'statusCode': 405,
        'body': json.dumps({'error': 'Method not allowed'})
    }

def get_profile(user_id):
    try:
        response = table.get_item(Key={'user_id': user_id})
        if 'Item' in response:
            return {
                'statusCode': 200,
                'body': json.dumps(response['Item'])
            }
        else:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Profile not found'})
            }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def update_profile(user_id, user_name):
    if not user_name or not user_name.strip():
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'user_name is required'})
        }
    
    try:
        now = datetime.utcnow().isoformat()
        table.update_item(
            Key={'user_id': user_id},
            UpdateExpression='SET user_name = :name, updated_at = :updated',
            ExpressionAttributeValues={
                ':name': user_name.strip(),
                ':updated': now
            }
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Profile updated successfully',
                'user_name': user_name.strip()
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
```

---

## Testing Checklist

### GET /user/profile
- [ ] Returns profile when user exists
- [ ] Returns 404 when user doesn't exist
- [ ] Returns 401 with invalid token
- [ ] Handles nested profile object or flat structure

### PUT /user/profile
- [ ] Updates user_name successfully
- [ ] Creates profile if doesn't exist
- [ ] Validates empty/null user_name (400 error)
- [ ] Returns updated user_name in response
- [ ] Handles Unicode characters and emojis
- [ ] Returns 401 with invalid token

### Integration
- [ ] Profile persists across requests
- [ ] Multiple updates work correctly
- [ ] Concurrent requests handled safely

---

## Frontend Behavior

### On Login
1. Checks Cognito for authentication
2. Extracts JWT tokens from session
3. Calls `GET /user/profile` to fetch display name
4. Falls back to email if profile doesn't exist or API fails
5. Caches display name in localStorage

### On Profile Update
1. User changes name in Settings page
2. Calls `PUT /user/profile` with new name
3. Updates local state immediately (optimistic update)
4. Re-fetches profile to confirm
5. Updates localStorage cache

### On Page Refresh
1. Loads cached display name from localStorage first
2. Then calls `GET /user/profile` to sync
3. Updates if server has newer value
4. Prevents "flicker" from email → name on load

---

## CORS Configuration
Ensure API Gateway/Lambda allows:
```
Access-Control-Allow-Origin: <your-frontend-domain>
Access-Control-Allow-Methods: GET, PUT, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Security Considerations

1. **Token Validation:** Always verify JWT signature with Cognito public keys
2. **User Isolation:** Ensure users can only access their own profile (use sub from token)
3. **Input Sanitization:** Strip whitespace, validate length
4. **Rate Limiting:** Consider rate limits on PUT requests
5. **Audit Logging:** Log profile changes for security audits

---

## API Gateway Configuration Example

**Route:** `/user/profile`

**Integration:** Lambda Function

**Authorizer:** JWT Authorizer (Cognito User Pool)

**Token Source:** `$request.header.Authorization`

**Identity Source:** `$request.header.Authorization`

---

## Questions?
Contact frontend team for integration support or frontend behavior clarifications.
