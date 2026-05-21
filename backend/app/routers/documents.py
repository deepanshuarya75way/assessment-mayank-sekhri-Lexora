from fastapi import APIRouter, HTTPException, Request, status

from app.schemas import DocumentIngestRequest, DocumentIngestResponse
from app.services.document_ingestion import ingest_document
from app.services.document_deletion import delete_document
from app.supabase_client import get_supabase_client

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


@router.post("/ingest", response_model=DocumentIngestResponse)
async def ingest_document_route(request: Request, payload: DocumentIngestRequest) -> DocumentIngestResponse:
    try:
        auth_header = request.headers.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

        token = auth_header.split(" ", 1)[1].strip()
        user = get_supabase_client().auth.get_user(token).user

        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")
        if str(user.id) != payload.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user_id does not match token")

        return await ingest_document(payload)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_route(request: Request, document_id: str) -> None:
    try:
        auth_header = request.headers.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

        token = auth_header.split(" ", 1)[1].strip()
        user = get_supabase_client().auth.get_user(token).user

        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")

        await delete_document(document_id, str(user.id))
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


from app.services.summarization import summarize_document_by_id

@router.post("/{document_id}/summarize")
async def summarize_document_route(request: Request, document_id: str):
    try:
        auth_header = request.headers.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

        token = auth_header.split(" ", 1)[1].strip()
        user = get_supabase_client().auth.get_user(token).user

        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")

        res = await summarize_document_by_id(document_id, str(user.id))
        return res
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc

