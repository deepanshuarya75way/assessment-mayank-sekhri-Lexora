import io
import docx
import pandas as pd
from typing import Any
import fitz
import pytesseract
from pdf2image import convert_from_bytes
from langchain_text_splitters import RecursiveCharacterTextSplitter

def extract_text_chunks(file_bytes: bytes, mime_type: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> tuple[list[dict[str, Any]], int]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len)
    chunk_records: list[dict[str, Any]] = []
    page_count = 1

    if mime_type == "application/pdf":
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_count = doc.page_count
        for page_index, page in enumerate(doc, start=1):
            page_text = page.get_text("text").strip()
            
            # OCR fallback for empty pages
            if len(page_text) < 50:
                images = convert_from_bytes(file_bytes, first_page=page_index, last_page=page_index)
                if images:
                    page_text = pytesseract.image_to_string(images[0]).strip()

            if not page_text:
                continue

            for chunk_text in splitter.split_text(page_text):
                cleaned = chunk_text.strip()
                if cleaned:
                    chunk_records.append({"text": cleaned, "page_number": page_index})
        doc.close()

    elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        doc = docx.Document(io.BytesIO(file_bytes))
        full_text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
        for chunk_text in splitter.split_text(full_text):
            cleaned = chunk_text.strip()
            if cleaned:
                chunk_records.append({"text": cleaned, "page_number": 1})

    elif mime_type == "text/csv":
        df = pd.read_csv(io.BytesIO(file_bytes))
        full_text = df.to_string()
        for chunk_text in splitter.split_text(full_text):
            cleaned = chunk_text.strip()
            if cleaned:
                chunk_records.append({"text": cleaned, "page_number": 1})

    elif mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        df = pd.read_excel(io.BytesIO(file_bytes))
        full_text = df.to_string()
        for chunk_text in splitter.split_text(full_text):
            cleaned = chunk_text.strip()
            if cleaned:
                chunk_records.append({"text": cleaned, "page_number": 1})
    else:
        # Fallback text decoding
        full_text = file_bytes.decode("utf-8", errors="ignore")
        for chunk_text in splitter.split_text(full_text):
            cleaned = chunk_text.strip()
            if cleaned:
                chunk_records.append({"text": cleaned, "page_number": 1})

    return chunk_records, page_count
