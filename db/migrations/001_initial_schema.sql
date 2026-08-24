-- Afiya AI - Initial Database Schema
-- Requires: PostgreSQL 14+ with pgvector extension

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- Table: medicines
-- Core medicine data with brand, generic, aliases
-- ============================================================================
CREATE TABLE medicines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255) NOT NULL,
    dosage_form VARCHAR(100) NOT NULL,
    strength VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(255),
    registration_info VARCHAR(255),
    aliases JSONB DEFAULT '[]'::JSONB,
    category VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Table: sources
-- Provenance origins for data (DRAP, Dawaai, manual, etc.)
-- ============================================================================
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url TEXT,
    source_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Table: medicine_prices
-- Links medicines to prices with source provenance
-- ============================================================================
CREATE TABLE medicine_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'PKR',
    package_size VARCHAR(100),
    package_description VARCHAR(255),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Table: knowledge_chunks
-- Text chunks with explicit provenance for RAG
-- ============================================================================
CREATE TABLE knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    chunk_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Table: embeddings
-- Vector representations for semantic search (768 dims for Gemini embedding)
-- ============================================================================
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chunk_id UUID NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
    embedding VECTOR(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Foreign key indexes for performance
CREATE INDEX idx_medicine_prices_medicine_id ON medicine_prices(medicine_id);
CREATE INDEX idx_medicine_prices_source_id ON medicine_prices(source_id);
CREATE INDEX idx_knowledge_chunks_medicine_id ON knowledge_chunks(medicine_id);
CREATE INDEX idx_knowledge_chunks_source_id ON knowledge_chunks(source_id);
CREATE INDEX idx_embeddings_chunk_id ON embeddings(chunk_id);

-- GIN index on aliases JSONB for alias matching
CREATE INDEX idx_medicines_aliases ON medicines USING GIN(aliases);

-- Index on brand_name and generic_name for exact matching
CREATE INDEX idx_medicines_brand_name ON medicines(LOWER(brand_name));
CREATE INDEX idx_medicines_generic_name ON medicines(LOWER(generic_name));

-- Vector similarity index (HNSW for better recall, created after data is loaded)
-- Note: Create this index AFTER seeding embeddings for best performance
CREATE INDEX idx_embeddings_vector ON embeddings
    USING hnsw (embedding vector_cosine_ops);
