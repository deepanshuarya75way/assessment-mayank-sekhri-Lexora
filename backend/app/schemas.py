from pydantic import BaseModel, Field


class DocumentIngestRequest(BaseModel):
    user_id: str = Field(min_length=1)
    bucket: str = Field(default="documents", min_length=1)
    file_path: str = Field(min_length=1)
    title: str = Field(min_length=1)
    mime_type: str = Field(default="application/pdf")


class DocumentIngestResponse(BaseModel):
    document_id: str
    chunks_indexed: int
    page_count: int
    status: str


class ChatAskRequest(BaseModel):
    user_id: str = Field(min_length=1)
    document_id: str | None = Field(default=None)
    workspace_id: str | None = Field(default=None)
    question: str = Field(min_length=1)
    alpha: float = Field(default=0.5, ge=0.0, le=1.0)
    top_k: int = Field(default=8, ge=1, le=20)
    session_id: str | None = Field(default=None)


class ChatSessionCreateRequest(BaseModel):
    user_id: str = Field(min_length=1)
    document_id: str | None = Field(default=None)
    workspace_id: str | None = Field(default=None)
    title: str = Field(default="New Chat", min_length=1)


class ChatSessionRenameRequest(BaseModel):
    user_id: str = Field(min_length=1)
    title: str = Field(min_length=1)


class ChatSessionResponse(BaseModel):
    id: str
    title: str
    document_id: str | None = None
    workspace_id: str | None = None
    created_at: str


class SourceCitation(BaseModel):
    document_id: str | None = None
    page_number: int
    chunk_text: str
    score: float


class ChatAskResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]


class WorkspaceCreateRequest(BaseModel):
    user_id: str = Field(min_length=1)
    name: str = Field(min_length=1)


class WorkspaceCreateResponse(BaseModel):
    workspace_id: str
    name: str
    status: str


class WorkspaceAddDocumentRequest(BaseModel):
    user_id: str = Field(min_length=1)
    document_id: str = Field(min_length=1)

class WorkspaceRenameRequest(BaseModel):
    user_id: str = Field(min_length=1)
    name: str = Field(min_length=1)

