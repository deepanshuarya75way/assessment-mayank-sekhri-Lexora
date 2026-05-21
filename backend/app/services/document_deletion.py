import asyncio
from typing import Any

from pinecone import Pinecone

from app.config import get_settings
from app.supabase_client import get_supabase_client


async def delete_document(document_id: str, user_id: str) -> None:
    supabase = get_supabase_client()
    settings = get_settings()

    # 1. Verify existence and ownership
    doc_query = supabase.table("documents").select("file_path").eq("id", document_id).eq("user_id", user_id).execute()
    if not doc_query.data:
        raise ValueError("Document not found or access denied")
    
    file_path = doc_query.data[0]["file_path"]

    # 2. Delete vectors from Pinecone
    if settings.pinecone_api_key and settings.pinecone_index_name:
        def _delete_from_pinecone() -> None:
            pc = Pinecone(api_key=settings.pinecone_api_key)
            index = pc.Index(settings.pinecone_index_name)
            # Pinecone serverless supports deleting by metadata
            index.delete(filter={"document_id": {"$eq": document_id}})
        
        try:
            await asyncio.to_thread(_delete_from_pinecone)
        except Exception as e:
            # Continue even if pinecone fails, or log it
            print(f"Error deleting from Pinecone: {e}")

    # 3. Delete file from Supabase Storage
    try:
        supabase.storage.from_("documents").remove([file_path])
    except Exception as e:
        print(f"Error deleting from Supabase Storage: {e}")

    # 4. Delete row from Supabase Database
    supabase.table("documents").delete().eq("id", document_id).eq("user_id", user_id).execute()
