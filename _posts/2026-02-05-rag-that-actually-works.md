---
layout: post
title: "RAG is Not Dead — How to Build RAG That Actually Works"
author: Zumry
categories: [ ai, tutorial ]
tags: [ rag, retrieval augmented generation, pgvector, embeddings, ollama, vector database ]
image: assets/images/rag_production.png
featured: false
description: "A practical guide to building RAG pipelines that work in production. Covers chunking strategies, embedding models, pgvector, hybrid search, and evaluation with real code examples."
---

Every few months, someone declares RAG is dead. A new model drops with a 1M or 2M token context window, and suddenly "just dump everything into the prompt" becomes the hot take. I have been building RAG systems in production, including [DocuMind, my document intelligence app](/building-documind-ai-document-intelligence/), and I can tell you with confidence: RAG is not dead. But most RAG implementations are broken.

Let me walk you through what actually works.

## Why People Think RAG Is Dead

The argument is simple. Models like Gemini and Claude now support context windows of 1M+ tokens. Why bother with retrieval when you can just shove every document into the prompt?

Here is why that falls apart in production:

- **Cost.** Sending 500K tokens per query gets expensive fast. At scale, you are burning money on context that is 95% irrelevant to the user's question.
- **Latency.** More tokens means slower responses. Users do not want to wait 30 seconds for an answer.
- **Freshness.** Your data changes. Documents get updated, new files get added. RAG lets you update your knowledge base without reprocessing everything.
- **Accuracy.** Models perform worse with massive contexts. The "lost in the middle" problem is real. Relevant information buried in 200 pages of text gets overlooked.
- **Scale.** You might have 10GB of documents. That does not fit in any context window.

RAG is not about working around model limitations. It is about building systems that are fast, cost-effective, and accurate at scale. This is also why RAG is a core component in [AI agents](/building-your-first-ai-agent/) — agents need to retrieve relevant context before they can reason and act on it.

## The Basic RAG Pipeline

Before fixing what is broken, let us walk through the standard pipeline:

1. **Ingest** — Load documents (PDFs, markdown, HTML, code files) into your system.
2. **Chunk** — Split documents into smaller pieces that capture meaningful units of information.
3. **Embed** — Convert each chunk into a vector (a list of numbers) using an embedding model.
4. **Store** — Save those vectors in a vector database for fast similarity search.
5. **Query** — When a user asks a question, embed their query using the same model.
6. **Retrieve** — Find the top-k most similar chunks from the vector store.
7. **Generate** — Pass the retrieved chunks plus the user query to an LLM to produce the final answer.

Simple enough on paper. The devil is in the details.

## Where RAG Goes Wrong

After building DocuMind and debugging countless retrieval issues, here are the most common failure points I have seen:

- **Bad chunking.** Chunks that are too large dilute relevance. Chunks that are too small lose context. Splitting mid-sentence or mid-paragraph destroys meaning.
- **Poor embeddings.** Using a weak embedding model means similar content does not end up near each other in vector space.
- **No reranking.** Vector similarity is a rough first pass. Without a reranker, you are trusting cosine similarity alone to find the best results.
- **Context stuffing.** Retrieving 20 chunks and dumping them all into the prompt confuses the model. Less is more.
- **Ignoring metadata.** Not filtering by document type, date, or source means your retrieval returns outdated or irrelevant content.

## Chunking Strategies That Work

Chunking is the single most impactful decision in your RAG pipeline. Here is what I have found works best:

**Fixed-size with overlap** is the simplest approach. Split text into chunks of 512-1024 tokens with 10-20% overlap. The overlap ensures you do not lose context at boundaries.

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
    separators=["\n\n", "\n", ". ", " "]
)
chunks = splitter.split_text(document_text)
```

**Semantic chunking** groups text by meaning rather than fixed size. You embed sentences and split where the embedding similarity drops significantly. This produces more natural chunks but is slower to process.

**Document-structure-aware chunking** is what I use in DocuMind. If you are dealing with PDFs, markdown, or HTML, respect the structure. Split on headings, sections, and logical boundaries. A chunk that contains one complete section is far more useful than one that contains half of two sections.

In practice, I combine document-structure-aware chunking with a max size fallback. Respect headings first, but if a section is too large, apply fixed-size splitting within it.

## Embedding Models

Your embedding model determines how well your system understands similarity. Here are the options I have tested:

- **OpenAI text-embedding-3-small** — Solid performance, easy to use, costs money per token. Good default for production.
- **Cohere embed-v3** — Strong multilingual support. Worth considering if your documents are not English-only.
- **nomic-embed-text** — Open source, runs locally via Ollama. Free, private, and surprisingly capable.

For DocuMind, I started with OpenAI embeddings and later added support for local embeddings via Ollama. If you want to keep costs at zero during development:

```bash
ollama pull nomic-embed-text
```

```python
import requests

def get_embedding(text: str) -> list[float]:
    response = requests.post(
        "http://localhost:11434/api/embeddings",
        json={"model": "nomic-embed-text", "prompt": text}
    )
    return response.json()["embedding"]
```

This runs entirely on your machine. No API keys, no costs, no data leaving your network.

## Vector Databases

You need somewhere to store and search your vectors. Here is the landscape:

- **pgvector (PostgreSQL)** — My recommendation for most teams. If you already use Postgres, just add the extension. No new infrastructure, familiar SQL, handles millions of vectors just fine.
- **Pinecone** — Managed service, zero ops. Good if you do not want to think about infrastructure.
- **Weaviate** — Feature-rich, supports hybrid search natively.
- **Qdrant** — Fast, Rust-based, great API design.

I use pgvector for DocuMind. The simplicity of keeping everything in one database (documents, metadata, vectors, user data) is hard to beat. Here is a basic setup:

```sql
CREATE EXTENSION vector;

CREATE TABLE document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(768),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

Query it with a simple SQL call:

```sql
SELECT content, metadata,
       1 - (embedding <=> $1) AS similarity
FROM document_chunks
WHERE document_id = ANY($2)
ORDER BY embedding <=> $1
LIMIT 5;
```

No new query language to learn. No separate service to deploy and monitor.

## Hybrid Search

Vector search alone misses things. If a user asks for "error code E4012", semantic similarity might not surface the exact document that mentions that code. Keyword search would find it instantly.

The solution is hybrid search: combine vector similarity with BM25 keyword matching.

```python
def hybrid_search(query: str, documents: list, alpha: float = 0.7):
    vector_results = vector_search(query, top_k=20)
    keyword_results = bm25_search(query, top_k=20)

    # Reciprocal Rank Fusion
    combined = {}
    for rank, doc in enumerate(vector_results):
        combined[doc.id] = combined.get(doc.id, 0) + alpha / (rank + 60)
    for rank, doc in enumerate(keyword_results):
        combined[doc.id] = combined.get(doc.id, 0) + (1 - alpha) / (rank + 60)

    return sorted(combined.items(), key=lambda x: x[1], reverse=True)[:5]
```

The `alpha` parameter controls the balance. I typically weight vector search higher (0.7) because semantic understanding matters more for most queries, but keyword search catches the exact-match cases that vectors miss.

## Evaluation — Measuring RAG Quality

You cannot improve what you do not measure. The three metrics I track:

- **Relevance** — Are the retrieved chunks actually related to the query?
- **Faithfulness** — Does the generated answer stick to the retrieved context, or is the model hallucinating?
- **Answer correctness** — Is the final answer actually right?

The **RAGAS** framework automates this. You provide a set of questions, ground truth answers, and let it score your pipeline:

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision

result = evaluate(
    dataset=eval_dataset,
    metrics=[faithfulness, answer_relevancy, context_precision]
)
print(result)
```

Build a test set of 50-100 question-answer pairs from your actual documents. Run evaluation after every pipeline change. This catches regressions before your users do.

## Production Tips

After running DocuMind in production, here are the things that made the biggest difference:

- **Cache embeddings aggressively.** If the same document has not changed, do not re-embed it. Hash the content and skip processing for unchanged chunks.
- **Process ingestion asynchronously.** Do not make users wait while you chunk and embed their documents. Queue the work, show progress, and notify when ready.
- **Monitor retrieval quality.** Log the queries, retrieved chunks, and user satisfaction signals. When users rephrase a question or say the answer was not helpful, that is your signal to investigate.
- **Add a feedback loop.** Let users flag bad answers. Use that data to identify weak spots in your chunking, embedding, or retrieval logic.
- **Set a relevance threshold.** Do not return chunks below a similarity score of 0.7. It is better to say "I don't have enough information" than to generate an answer from irrelevant context.

## Final Thoughts

RAG is not dead. Lazy RAG is dead. If you treat it as "split text, embed, hope for the best," you will get terrible results and conclude the technique does not work.

But if you invest in good chunking, pick the right embedding model, use hybrid search, add reranking, and actually measure your results, RAG gives you something that long-context models alone cannot: a fast, cost-effective, and scalable system that stays accurate as your data grows.

Start simple. Measure everything. Iterate based on real user queries. That is how you build RAG that actually works.
