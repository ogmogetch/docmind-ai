# DocMind

Chat with your documents. Upload a PDF, DOCX or TXT, get an automatic summary, then ask questions and receive answers grounded in the source — with page-level citations.

Built as a full end-to-end **Retrieval-Augmented Generation (RAG)** pipeline: local embeddings, pgvector search, and streamed LLM responses.

---

## Features

- **Multi-format ingestion** — PDF, DOCX, TXT
- **Automatic summary** on upload
- **Grounded chat** — answers cite the exact chunk (page + passage) they came from
- **Streamed responses** — token-by-token, no blocking wait
- **Local embeddings** — no third-party embeddings API; the model runs in the Node process
- **Provider-agnostic LLM** — Groq (free tier, default) or Anthropic Claude
- **Anti-hallucination guardrail** — when no relevant chunk is retrieved, the app says so instead of inventing

---

## How it works

```
┌──────────────┐   ┌───────────┐   ┌────────────────┐   ┌──────────────┐
│ Upload PDF/  │──▶│  Extract  │──▶│  Chunk (≈500   │──▶│   Embed      │
│  DOCX / TXT  │   │   text    │   │  tok, overlap) │   │ (local model)│
└──────────────┘   └───────────┘   └────────────────┘   └──────┬───────┘
                                                               │
                                                               ▼
                                                        ┌──────────────┐
                                                        │  pgvector    │
                                                        │  (Supabase)  │
                                                        └──────┬───────┘
                                                               │
┌──────────────┐   ┌───────────┐   ┌────────────────┐   ┌──────▼───────┐
│  User asks   │──▶│  Embed    │──▶│  Cosine top-k  │──▶│  Streamed    │
│  a question  │   │  question │   │   retrieval    │   │  LLM answer  │
└──────────────┘   └───────────┘   └────────────────┘   │ + citations  │
                                                        └──────────────┘
```

The LLM is instructed to answer **only** from the retrieved chunks. Retrieved passages are returned with the response so the UI can display and highlight the source.

---

## Tech stack

| Layer            | Choice                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Framework        | Next.js 14 (App Router) + TypeScript                                   |
| Styling          | Tailwind CSS                                                           |
| LLM              | Groq (Llama 3.3 70B, default) or Anthropic Claude                      |
| Embeddings       | `@xenova/transformers` — `all-MiniLM-L6-v2`, 384-d, runs in Node       |
| Vector store     | Supabase Postgres + `pgvector`                                         |
| Text extraction  | `pdf-parse` (PDF), `mammoth` (DOCX)                                    |
| PDF preview      | `react-pdf`                                                            |
| Validation       | `zod`                                                                  |
| Tests            | Vitest                                                                 |

---

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier is fine)
- A Groq API key — [console.groq.com/keys](https://console.groq.com/keys) *(or an Anthropic key if you prefer Claude)*

### Install

```bash
npm install
cp .env.example .env.local
```

### Configure Supabase

In the Supabase SQL editor, run:

```
supabase/schema.sql
```

This enables the `pgvector` extension and creates the `documents` / `chunks` tables plus the similarity-search function.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable                    | Required                    | Description                                                     |
| --------------------------- | --------------------------- | --------------------------------------------------------------- |
| `GROQ_API_KEY`              | If `LLM_PROVIDER=groq`      | Groq API key                                                    |
| `GROQ_MODEL`                | No                          | Default `llama-3.3-70b-versatile`                               |
| `LLM_PROVIDER`              | No                          | `groq` (default) or `anthropic`                                 |
| `ANTHROPIC_API_KEY`         | If `LLM_PROVIDER=anthropic` | Anthropic API key                                               |
| `ANTHROPIC_MODEL`           | No                          | Default `claude-sonnet-4-6`                                     |
| `SUPABASE_URL`              | Yes                         | Project URL                                                     |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes                         | Service role key — **backend only, never expose to the client** |
| `EMBEDDING_MODEL`           | No                          | Default `Xenova/all-MiniLM-L6-v2`                               |

---

## Scripts

| Command             | What it does                     |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the dev server             |
| `npm run build`     | Production build                 |
| `npm run start`     | Run the production build         |
| `npm run lint`      | Lint                             |
| `npm test`          | Run the test suite once (Vitest) |
| `npm run test:watch`| Vitest in watch mode             |

---

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── upload/route.ts    # extract → chunk → embed → store
│   │   ├── chat/route.ts      # retrieval + streamed LLM response
│   │   └── summary/route.ts   # document summary
│   └── page.tsx               # upload + chat + PDF preview
├── lib/
│   ├── extract.ts             # PDF/DOCX/TXT text extraction
│   ├── chunk.ts               # chunking with overlap
│   ├── embeddings.ts          # local embeddings (transformers.js)
│   ├── rag.ts                 # retrieval pipeline
│   ├── llm.ts                 # provider-agnostic LLM client (Groq / Anthropic)
│   └── supabase.ts            # Supabase client
└── components/
    ├── UploadZone.tsx
    ├── Chat.tsx
    └── PdfPreview.tsx

supabase/
└── schema.sql                 # pgvector + tables + search function

tests/                         # Vitest specs
```

---

## Design notes

- **The document is never sent whole to the LLM.** Every question triggers a fresh retrieval; only the top-k relevant chunks reach the model.
- **API key never touches the browser.** All LLM calls go through Next.js API routes.
- **Fallback on empty retrieval.** If no chunk clears the similarity threshold, the app responds *"I couldn't find this information in the document"* rather than hallucinating.

---

## Deployment

- **Frontend + API** — Vercel (one click; the App Router API handles server work)
- **Database + vector store** — Supabase

Set the same environment variables in your Vercel project settings.

---

## License

MIT