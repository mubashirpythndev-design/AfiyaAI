"""RAG retrieval service using Gemini embeddings and pgvector.

Falls back to direct knowledge chunk retrieval when pgvector is unavailable (SQLite).
"""

import logging
import asyncio
from typing import Optional
import google.generativeai as genai
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db.database import is_sqlite, KnowledgeChunk, Source

logger = logging.getLogger(__name__)


async def generate_embedding(query: str) -> list[float]:
    """Generate embedding for a query using Gemini."""
    genai.configure(api_key=settings.gemini_api_key)
    result = await asyncio.wait_for(asyncio.to_thread(genai.embed_content,
        model=settings.gemini_embedding_model,
        content=query,
        task_type="retrieval_query",
        output_dimensionality=settings.embedding_dimensions,
        request_options={"timeout": settings.ai_timeout_seconds},
    ), timeout=settings.ai_timeout_seconds + 1)
    return result["embedding"]


async def retrieve_context(medicine_id: str, query: str, db: AsyncSession) -> dict:
    """Retrieve relevant knowledge chunks for a medicine using RAG."""
    # SQLite fallback: return chunks directly without vector similarity
    if is_sqlite:
        return await _retrieve_context_sqlite(medicine_id, db)

    # PostgreSQL with pgvector
    try:
        embedding = await generate_embedding(query)
        embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

        # Query pgvector for similar chunks filtered by medicine_id
        result = await db.execute(
            text("""
                SELECT kc.id, kc.content, kc.chunk_type,
                       s.name as source_name, s.url as source_url, s.source_type, s.verification_status,
                       1 - (e.embedding <=> CAST(:query_embedding AS vector)) as similarity
                FROM embeddings e
                JOIN knowledge_chunks kc ON e.chunk_id = kc.id
                JOIN sources s ON kc.source_id = s.id
                WHERE kc.medicine_id = :medicine_id
                ORDER BY e.embedding <=> CAST(:query_embedding AS vector)
                LIMIT :top_k
            """),
            {
                "query_embedding": embedding_str,
                "medicine_id": medicine_id,
                "top_k": settings.rag_top_k,
            },
        )

        rows = result.fetchall()
        chunks = []
        sources = []
        seen_sources = set()

        for row in rows:
            similarity = float(row.similarity) if row.similarity else 0.0
            if similarity < settings.rag_similarity_threshold:
                continue

            chunks.append({
                "id": str(row.id),
                "content": row.content,
                "chunk_type": row.chunk_type,
                "source": {
                    "name": row.source_name,
                    "url": row.source_url,
                    "source_type": row.source_type,
                    "verification_status": row.verification_status,
                },
            })

            source_key = row.source_name
            if source_key not in seen_sources:
                seen_sources.add(source_key)
                sources.append({
                    "name": row.source_name,
                    "url": row.source_url,
                    "source_type": row.source_type,
                })

        if not chunks:
            # Fallback to direct knowledge retrieval so known medicines always have complete context
            return await _retrieve_context_sqlite(medicine_id, db)

        # Assemble context string for LLM
        context_parts = []
        for chunk in chunks:
            context_parts.append(f"[{chunk['chunk_type']}] {chunk['content']} (Source: {chunk['source']['name']})")

        return {
            "context": "\n\n".join(context_parts),
            "chunks": chunks,
            "sources": sources,
        }

    except Exception as e:
        logger.warning(f"pgvector retrieval failed: {e}. Falling back to direct database retrieval...")
        await db.rollback()
        return await _retrieve_context_sqlite(medicine_id, db)


async def _retrieve_context_sqlite(medicine_id: str, db: AsyncSession) -> dict:
    """Simple knowledge chunk retrieval without vector search (SQLite fallback)."""
    try:
        result = await db.execute(
            select(KnowledgeChunk)
            .where(KnowledgeChunk.medicine_id == medicine_id)
            .options(selectinload(KnowledgeChunk.source))
        )
        chunks_list = result.scalars().all()

        if not chunks_list:
            return {
                "context": "No verified information found for this medicine in our database.",
                "chunks": [],
                "sources": [],
            }

        chunks = []
        sources = []
        seen_sources = set()

        for chunk in chunks_list:
            chunks.append({
                "id": str(chunk.id),
                "content": chunk.content,
                "chunk_type": chunk.chunk_type,
                "source": {
                    "name": chunk.source.name,
                    "url": chunk.source.url,
                    "source_type": chunk.source.source_type,
                    "verification_status": chunk.source.verification_status,
                },
            })
            if chunk.source.name not in seen_sources:
                seen_sources.add(chunk.source.name)
                sources.append({
                    "name": chunk.source.name,
                    "url": chunk.source.url,
                    "source_type": chunk.source.source_type,
                })

        context_parts = []
        for chunk in chunks:
            context_parts.append(f"[{chunk['chunk_type']}] {chunk['content']} (Source: {chunk['source']['name']})")

        return {
            "context": "\n\n".join(context_parts),
            "chunks": chunks,
            "sources": sources,
        }
    except Exception as e:
        logger.error(f"SQLite RAG retrieval failed: {e}")
        return {
            "context": "Unable to retrieve information at this time.",
            "chunks": [],
            "sources": [],
        }
