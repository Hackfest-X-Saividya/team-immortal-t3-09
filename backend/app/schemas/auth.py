from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

AccountType = Literal["individual", "college", "organization"]


class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="User full name")
    email: EmailStr = Field(..., description="Valid unique email address")
    password: str = Field(..., min_length=8, max_length=100, description="Minimum 8 characters password")
    account_type: AccountType = Field(
        default="individual",
        description="Role / account type: individual, college, or organization",
    )
    workspace_name: Optional[str] = Field(None, max_length=100, description="Optional custom workspace title")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v


class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserProfileResponse(BaseModel):
    id: str
    full_name: str
    email: str
    workspace_id: str
    workspace_name: str
    account_type: str = "individual"
    created_at: str
    avatar_url: Optional[str] = None
    initials: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse
