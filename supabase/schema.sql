-- DocMind schema for Supabase / pgvector
-- Execute this in the Supabase SQL editor once before using the app.

create extension if not exists vector;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  mime_type text not null,
  raw_text text not null,
  summary text,
  page_count int,
  created_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id bigserial primary key,
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  page int,
  content text not null,
  embedding vector(384) not null
);

create index if not exists document_chunks_document_idx
  on document_chunks (document_id);

create index if not exists document_chunks_embedding_idx
  on document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Cosine similarity search RPC.
-- Returns the top_k most similar chunks for a document, ordered by similarity desc.
create or replace function match_document_chunks(
  p_document_id uuid,
  p_query_embedding vector(384),
  p_match_count int default 5
)
returns table (
  id bigint,
  chunk_index int,
  page int,
  content text,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.chunk_index,
    dc.page,
    dc.content,
    1 - (dc.embedding <=> p_query_embedding) as similarity
  from document_chunks dc
  where dc.document_id = p_document_id
  order by dc.embedding <=> p_query_embedding
  limit p_match_count;
$$;
