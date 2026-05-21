from typing import Any

import fitz
from langchain_text_splitters import RecursiveCharacterTextSplitter


def extract_chunked_page_text(pdf_bytes: bytes, chunk_size: int = 1000, chunk_overlap: int = 200) -> tuple[list[dict[str, Any]], int]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    chunk_records: list[dict[str, Any]] = []

    for page_index, page in enumerate(doc, start=1):
        page_text = page.get_text("text").strip()
        if not page_text:
            continue

        for chunk_text in splitter.split_text(page_text):
            cleaned = chunk_text.strip()
            if cleaned:
                chunk_records.append({"text": cleaned, "page_number": page_index})

    page_count = doc.page_count
    doc.close()

    return chunk_records, page_count
