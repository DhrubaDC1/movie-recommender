import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from db import create_user, get_user_by_email, get_user_by_id, get_user_by_username

SECRET_KEY = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRY_DAYS = 7
COOKIE_NAME = "cm_access_token"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["auth"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS)
    return jwt.encode(
        {"sub": user_id, "email": email, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,      # set True behind HTTPS in production
        samesite="lax",
        max_age=TOKEN_EXPIRY_DAYS * 86400,
        path="/",
    )


# ── FastAPI dependencies ───────────────────────────────────────────────────────

async def get_current_user(
    token: Optional[str] = Cookie(default=None, alias=COOKIE_NAME),
) -> dict:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub", "")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_optional_user(
    token: Optional[str] = Cookie(default=None, alias=COOKIE_NAME),
) -> Optional[dict]:
    if not token:
        return None
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub", "")
        return await get_user_by_id(user_id)
    except (JWTError, Exception):
        return None


# ── Request / Response models ──────────────────────────────────────────────────

class SignupRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    username: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=UserResponse)
async def signup(req: SignupRequest, response: Response):
    if len(req.username) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    if await get_user_by_email(req.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    if await get_user_by_username(req.username):
        raise HTTPException(status_code=409, detail="Username already taken")

    user_id = str(uuid.uuid4())
    await create_user(user_id, req.email, req.username, hash_password(req.password))

    token = create_token(user_id, req.email)
    _set_auth_cookie(response, token)
    return UserResponse(id=user_id, email=req.email, username=req.username)


@router.post("/login", response_model=UserResponse)
async def login(req: LoginRequest, response: Response):
    user = await get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(user["id"], user["email"])
    _set_auth_cookie(response, token)
    return UserResponse(id=user["id"], email=user["email"], username=user["username"])


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def me(user: dict = Depends(get_current_user)):
    return UserResponse(id=user["id"], email=user["email"], username=user["username"])
