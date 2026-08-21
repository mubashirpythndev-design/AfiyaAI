---
name: rag-retrieval
description: Workflow for safely retrieving and assembling context using RAG.
---

# RAG Retrieval Skill

## Preconditions
- The query must map to a `verified medicine` in the database.
- Embedding model must be available and initialized.

## Retrieval Workflow
1. **Metadata Filtering**: Query the authoritative DB for the verified medicine ID to scope the RAG search.
2. **Embedding**: Generate the vector embedding for the user's specific query.
3. **pgvector Search**: Perform vector similarity search specifically filtered by the verified medicine ID.
4. **Authoritative Lookup**: Retrieve the raw `knowledge_chunks` and associated `sources` for the top-k vectors.
5. **Context Assembly**: Combine structured facts (prices, names) and unstructured chunks with clear source citations.

## Failure & Edge Case Handling
- **Empty/Low-Confidence Retrieval**: If no chunks exceed the similarity threshold, the LLM context must state: "No verified information found."
- **Source Preservation**: Every knowledge chunk passed to the LLM must have its origin source attached.
- **No Hallucination Behavior**: The LLM must be explicitly instructed in the system prompt to ONLY use the assembled context.

## Crucial Rule
- NEVER generate unsupported facts.
