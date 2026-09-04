from typing import Literal

from pydantic import BaseModel, Field, field_validator

ProviderName = Literal[
    "openai",
    "stability",
    "huggingface",
]
AccountStatusName = Literal["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "BANNED"]
UserRoleName = Literal["USER", "MODERATOR", "ADMIN"]
ReportStatusName = Literal["OPEN", "UNDER_REVIEW", "ACTIONED", "DISMISSED"]
ModerationActionName = Literal["WARN", "SUSPEND", "BAN", "REINSTATE", "REMOVE_CONTENT"]
ViolationCategoryName = Literal[
    "CSAM",
    "NON_CONSENSUAL_INTIMATE",
    "REAL_PERSON_WITHOUT_CONSENT",
    "HATE_OR_HARASSMENT",
    "VIOLENT_EXTREMISM",
    "COPYRIGHT_INFRINGEMENT",
    "DECEPTIVE_DEEPFAKE",
    "OTHER",
]


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1000, description="Text prompt for AI image generation")
    provider: ProviderName | None = Field(
        default=None,
        description="Optional provider override. Defaults to IMAGE_PROVIDER env var.",
    )
    attested_ethical_use: bool = Field(default=False)
    attested_no_real_person_misuse: bool = Field(default=False)


class GenerateImageResponse(BaseModel):
    image_base64: str
    provider: str
    generation_id: int | None = None
    duration_ms: int | None = None
    model: str | None = None


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=72)
    display_name: str = Field(..., min_length=2, max_length=80)
    is_adult: bool = Field(default=False)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("display_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Display name is too short")
        return cleaned


class AuthUser(BaseModel):
    id: str
    email: str
    displayName: str | None
    role: str
    status: str
    isAdult: bool
    emailVerifiedAt: str | None = None
    lastLoginAt: str | None = None
    createdAt: str | None = None
    suspendedUntil: str | None = None


class AuthResponse(BaseModel):
    token: str
    user: AuthUser


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=80)
    is_adult: bool | None = None


class CreateReportRequest(BaseModel):
    prompt_log_id: int
    violation_category: ViolationCategoryName
    details: str | None = Field(default=None, max_length=2000)


class AdminUserUpdateRequest(BaseModel):
    role: UserRoleName | None = None
    status: AccountStatusName | None = None


class AdminModerationRequest(BaseModel):
    target_user_id: str
    action: ModerationActionName
    reason: str = Field(..., min_length=3, max_length=1000)
    violation_category: ViolationCategoryName | None = None
    prompt_log_id: int | None = None


class AdminReportUpdateRequest(BaseModel):
    status: ReportStatusName


class AcceptConsentRequest(BaseModel):
    policy_document_id: str


FeedbackVerdictName = Literal["UP", "DOWN"]
FeedbackTagName = Literal[
    "accurate",
    "creative",
    "not_what_i_asked",
    "low_quality",
    "felt_unsafe",
    "overblocked",
    "slow",
    "provider_issue",
]

FEEDBACK_TAGS: tuple[str, ...] = (
    "accurate",
    "creative",
    "not_what_i_asked",
    "low_quality",
    "felt_unsafe",
    "overblocked",
    "slow",
    "provider_issue",
)


class UpsertGenerationFeedbackRequest(BaseModel):
    verdict: FeedbackVerdictName
    tags: list[FeedbackTagName] = Field(default_factory=list, max_length=8)
    remark: str | None = Field(default=None, max_length=500)

    @field_validator("tags")
    @classmethod
    def unique_tags(cls, value: list[str]) -> list[str]:
        # Preserve order while dropping duplicates.
        seen: set[str] = set()
        ordered: list[str] = []
        for tag in value:
            if tag not in seen:
                seen.add(tag)
                ordered.append(tag)
        return ordered

    @field_validator("remark")
    @classmethod
    def clean_remark(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        return cleaned or None
