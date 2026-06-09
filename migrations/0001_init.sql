-- 0001_init: documents + chunks (pgvector). ${EMBEDDING_DIM} is substituted by
-- the migration runner from EMBEDDING_DIM (default 768 for Gemini
-- text-embedding-004). The column dimension is the guardrail that rejects
-- mismatched-dimension embeddings.

CREATE EXTENSION IF NOT EXISTS vector;

-- One row per ingested document.
CREATE TABLE IF NOT EXISTS documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT        NOT NULL,
    source_url   TEXT,
    -- Operational columns (beyond the minimal spec) so ingestion is observable.
    status       TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    chunk_count  INTEGER     NOT NULL DEFAULT 0,
    error        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per text chunk, with its embedding.
CREATE TABLE IF NOT EXISTS chunks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content      TEXT        NOT NULL,
    embedding    VECTOR(${EMBEDDING_DIM}) NOT NULL,
    chunk_index  INTEGER     NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);

-- IVFFlat index for cosine similarity search. `lists` trades build/probe cost
-- against recall; 100 is a sane default for small/medium corpora.
CREATE INDEX IF NOT EXISTS chunks_embedding_ivfflat_idx
    ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
