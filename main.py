from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(
    title="Demo API Swagger UI",
    description="API demo với FastAPI và Swagger UI chuẩn dự án",
    version="1.0.0"
)

# =====================
# MODELS
# =====================
class User(BaseModel):
    name: str
    age: int

    class Config:
        schema_extra = {
            "example": {"name": "David", "age": 28}
        }

class UserResponse(BaseModel):
    id: int
    name: str
    age: int

class UsersResponse(BaseModel):
    users: List[UserResponse]

class CreateUserResponse(BaseModel):
    message: str
    user: UserResponse

# =====================
# DATA GIẢ LẬP
# =====================
users = [
    {"id": 0, "name": "Alice", "age": 25},
    {"id": 1, "name": "Bob", "age": 30},
    {"id": 2, "name": "Charlie", "age": 35}
]

# =====================
# API ENDPOINTS
# =====================

# GET cơ bản
@app.get("/hello", tags=["General"], summary="Hello API",
         description="API trả về lời chào đơn giản")
def hello():
    return {"message": "Hello from FastAPI!"}

# GET danh sách users
@app.get("/users", tags=["Users"], summary="Lấy danh sách users",
         description="Trả về tất cả user hiện có",
         response_model=UsersResponse)
def get_users():
    return {"users": users}

# GET với path parameter
@app.get("/users/{user_id}", tags=["Users"], summary="Lấy user theo ID",
         description="Trả về thông tin user theo user_id",
         response_model=UserResponse,
         responses={404: {"description": "User not found"}})
def get_user(user_id: int):
    if 0 <= user_id < len(users):
        return users[user_id]
    raise HTTPException(status_code=404, detail="User not found")

# GET với query parameter
@app.get("/search", tags=["Users"], summary="Tìm kiếm user theo tên",
         description="Tìm user dựa trên tên, không nhập trả tất cả",
         response_model=UsersResponse)
def search_user(name: Optional[str] = None):
    if name:
        result = [user for user in users if name.lower() in user["name"].lower()]
        return {"users": result}
    return {"users": users}

# POST thêm user
@app.post("/users", tags=["Users"], summary="Thêm user mới",
          description="Tạo user mới với name và age",
          response_model=CreateUserResponse,
          status_code=201,
          responses={400: {"description": "Invalid input"}})
def create_user(user: User):
    new_id = len(users)
    new_user = {"id": new_id, "name": user.name, "age": user.age}
    users.append(new_user)
    return {"message": f"User {user.name} added", "user": new_user}

# GET protected với header
@app.get("/protected", tags=["Auth"], summary="API bảo vệ với token",
         description="Cần x-token header để truy cập",
         responses={401: {"description": "Invalid token"}})
def protected(x_token: str = Header(...)):
    if x_token == "mysecrettoken":
        return {"message": "Access granted"}
    raise HTTPException(status_code=401, detail="Invalid token")
