from typing import Any

from app.schemas import DocumentIngestRequest, DocumentIngestResponse
from app.services.hybrid_indexer import upsert_hybrid_chunks
from app.services.file_processing import extract_text_chunks
from app.services.summarization import generate_summary_and_entities
from app.supabase_client import get_supabase_client


def _first_row(data: Any) -> dict[str, Any]:
    if isinstance(data, list) and data:
        return data[0]
    raise ValueError("Expected at least one row in Supabase response")


async def ingest_document(request: DocumentIngestRequest) -> DocumentIngestResponse:
    supabase = get_supabase_client()

    document_insert = (
        supabase.table("documents")
        .insert(
            {
                "user_id": request.user_id,
                "title": request.title,
                "file_path": request.file_path,
                "mime_type": request.mime_type,
                "status": "processing",
            }
        )
        .execute()
    )

    document_row = _first_row(document_insert.data)
    document_id = str(document_row["id"])

    try:
        file_bytes = supabase.storage.from_(request.bucket).download(request.file_path)
        if not file_bytes:
            raise ValueError("Downloaded file is empty")

        chunk_records, page_count = extract_text_chunks(file_bytes, request.mime_type)
        if not chunk_records:
            raise ValueError("No text chunks were extracted from this file")

        chunks_indexed = await upsert_hybrid_chunks(
            document_id=document_id,
            user_id=request.user_id,
            chunk_records=chunk_records,
        )

        summary, entities = await generate_summary_and_entities(chunk_records)

        supabase.table("documents").update(
            {
                "file_size": len(file_bytes),
                "status": "completed",
                "summary": summary,
                "entities": entities,
            }
        ).eq("id", document_id).execute()

        return DocumentIngestResponse(
            document_id=document_id,
            chunks_indexed=chunks_indexed,
            page_count=page_count,
            status="completed",
        )
    except Exception:
        supabase.table("documents").update({"status": "failed"}).eq("id", document_id).execute()
        raise
