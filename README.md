# DocMind

Application d'analyse de documents alimentée par IA. Dépose un PDF ou un fichier texte, obtiens un résumé automatique, puis discute avec le document dans un chat qui cite ses sources.

## Pourquoi ce projet

Démontre une compétence recherchée en 2026 : **Retrieval-Augmented Generation (RAG)**. Ce n'est pas un simple wrapper autour d'une API. Le pipeline complet est ici :

1. Extraction du texte (PDF, TXT, DOCX)
2. Découpage en chunks avec chevauchement
3. Génération d'**embeddings vectoriels en local** avec `@xenova/transformers` (aucune dépendance à une API tierce pour les embeddings — le modèle tourne dans le processus Node)
4. Stockage dans **pgvector** sur Supabase
5. Recherche sémantique (cosine similarity) sur la question
6. Prompt contextualisé envoyé à Claude en streaming
7. Réponses sourcées (numéro de page / passage exact)

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- LLM au choix : **Groq** (Llama 3.3 70B, gratuit, par défaut) ou **Anthropic Claude** (payant, optionnel)
- `@xenova/transformers` (`all-MiniLM-L6-v2`) pour les embeddings locaux — 384 dimensions
- Supabase + pgvector pour le stockage vectoriel
- `pdf-parse` et `mammoth` pour l'extraction
- `react-pdf` pour la prévisualisation
- Vitest pour les tests

## Setup

```bash
npm install
cp .env.example .env.local
# remplir les variables (voir .env.example)
npm run dev
```

Puis http://localhost:3000

### Variables d'environnement

| Variable                    | Description                                                            |
| --------------------------- | ---------------------------------------------------------------------- |
| `GROQ_API_KEY`              | Clé Groq (console.groq.com/keys) — provider par défaut, tier gratuit   |
| `GROQ_MODEL`                | Modèle Groq, défaut `llama-3.3-70b-versatile`                          |
| `LLM_PROVIDER`              | `groq` (défaut) ou `anthropic`                                         |
| `ANTHROPIC_API_KEY`         | Requis uniquement si `LLM_PROVIDER=anthropic`                          |
| `SUPABASE_URL`              | URL du projet Supabase                                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (backend uniquement, jamais exposée)                  |

### Setup Supabase / pgvector

Dans le SQL editor Supabase, exécute `supabase/schema.sql`.

## Tests

```bash
npm test
```

## Architecture

```
src/
  app/
    api/
      upload/route.ts       # upload + extraction + chunking + embeddings + stockage
      chat/route.ts         # retrieval + streaming Claude
      summary/route.ts      # résumé du document
    page.tsx                # UI principale (upload + chat + preview)
  lib/
    extract.ts              # extraction texte PDF/DOCX/TXT
    chunk.ts                # découpage en chunks avec overlap
    embeddings.ts           # embeddings locaux via transformers.js
    supabase.ts             # client Supabase
    claude.ts               # client Anthropic
    rag.ts                  # pipeline retrieval
  components/
    UploadZone.tsx
    Chat.tsx
    PdfPreview.tsx
```

## Licence

MIT