---
layout: post
title: "Building DocuMind — AI-Powered Document Intelligence with Go and Flutter"
author: Zumry
categories: [ ai, tutorial ]
tags: [ documind, golang, flutter, pgvector, semantic search, rag, ollama ]
image: assets/images/documind.png
featured: true
description: "How I built DocuMind — an AI-powered document scanner with semantic search and RAG-based chat using Go, Flutter, pgvector, Ollama, and DeepSeek. Full architecture and code walkthrough."
---

I spend a lot of time reading technical documents, contracts, and research papers. The frustration is always the same: I know the answer is somewhere in these files, but finding it takes forever. Traditional keyword search is brittle. You need to remember the exact phrase the author used. Search for "payment deadline" and you miss the paragraph that says "invoices are due within 30 days." The meaning is there, but the words do not match.

I wanted to build something where I could upload a document and just ask it questions in plain English. That project became **DocuMind** — an AI-powered document intelligence app with a Go backend and a Flutter mobile frontend.

## Architecture Overview

DocuMind follows a clean separation between the mobile client and the API server. The Flutter app handles document scanning, upload, and chat UI. The Go backend handles everything else: storage, text processing, embeddings, vector search, and LLM-powered responses.

```
┌─────────────────┐
│  Flutter App     │
│  (Mobile Client) │
└────────┬────────┘
         │ REST API
┌────────▼────────┐
│   Go Backend     │
│   (Chi Router)   │
├──────────────────┤
│  PostgreSQL      │  ← document metadata + pgvector embeddings
│  MinIO           │  ← raw file storage (S3-compatible)
│  Ollama          │  ← local embeddings (nomic-embed-text)
│  DeepSeek        │  ← chat completions + summaries
└──────────────────┘
```

When a user uploads a document, the backend stores the raw file in MinIO, extracts the text, chunks it into manageable pieces, generates vector embeddings for each chunk using Ollama's `nomic-embed-text` model, stores those vectors in PostgreSQL with pgvector, and generates a summary using DeepSeek. After that, the document is fully searchable and conversational.

## The Go Backend

I chose Go for the backend because it is fast, compiles to a single binary, and handles concurrent requests well. The project follows clean architecture with the `internal/` package pattern.

```
cmd/api/
  main.go
internal/
  config/       # environment and app configuration
  models/       # data structures
  repository/   # PostgreSQL queries
  vectordb/     # pgvector operations
  storage/      # MinIO file storage
  ai/           # Ollama + DeepSeek clients
  service/      # business logic orchestration
  handler/      # HTTP handlers
migrations/     # SQL migration files
```

The Chi router keeps the API surface clean and composable. Each handler focuses on a single concern and delegates business logic to the service layer.

```go
func (app *application) routes() http.Handler {
    r := chi.NewRouter()
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(cors.Handler(cors.Options{
        AllowedOrigins: []string{"*"},
        AllowedMethods: []string{"GET", "POST", "PUT", "DELETE"},
    }))

    r.Route("/api/v1", func(r chi.Router) {
        r.Post("/documents", app.handleUpload)
        r.Get("/documents", app.handleListDocuments)
        r.Get("/documents/{id}", app.handleGetDocument)
        r.Delete("/documents/{id}", app.handleDeleteDocument)

        r.Post("/documents/{id}/process", app.handleProcessDocument)
        r.Post("/documents/{id}/summary", app.handleGenerateSummary)
        r.Post("/documents/search", app.handleSemanticSearch)
        r.Post("/documents/{id}/chat", app.handleChat)
    })

    return r
}
```

The processing pipeline is the heart of the backend. When a client calls `/process`, the service layer orchestrates the full pipeline:

```go
func (s *DocumentService) ProcessDocument(ctx context.Context, docID string) error {
    // 1. Fetch document metadata
    doc, err := s.repo.GetDocument(ctx, docID)
    if err != nil {
        return fmt.Errorf("fetching document: %w", err)
    }

    // 2. Download raw file from MinIO
    content, err := s.storage.GetFile(ctx, doc.StoragePath)
    if err != nil {
        return fmt.Errorf("downloading file: %w", err)
    }

    // 3. Extract and chunk text
    chunks := s.chunkText(string(content), 512, 50)

    // 4. Generate embeddings via Ollama (nomic-embed-text)
    for i, chunk := range chunks {
        embedding, err := s.ai.GenerateEmbedding(ctx, chunk.Text)
        if err != nil {
            return fmt.Errorf("generating embedding for chunk %d: %w", i, err)
        }
        chunk.Embedding = embedding
    }

    // 5. Store vectors in pgvector
    if err := s.vectorDB.StoreChunks(ctx, docID, chunks); err != nil {
        return fmt.Errorf("storing chunks: %w", err)
    }

    // 6. Generate summary via DeepSeek
    summary, err := s.ai.GenerateSummary(ctx, string(content))
    if err != nil {
        return fmt.Errorf("generating summary: %w", err)
    }

    return s.repo.UpdateDocumentSummary(ctx, docID, summary)
}
```

The chunking function uses a sliding window approach with overlap. Each chunk is 512 tokens with a 50-token overlap so that context is not lost at chunk boundaries. This overlap turned out to be more important than I initially expected. Without it, sentences split across two chunks would lose meaning in both.

## Semantic Search with pgvector

pgvector is a PostgreSQL extension that adds vector data types and similarity search operators directly to your database. No need for a separate vector database like Pinecone or Weaviate. Your vectors live right next to your relational data.

The core idea: convert the user's search query into an embedding using the same model (nomic-embed-text), then find the stored chunks with the smallest cosine distance to that query vector.

```sql
SELECT
    c.id,
    c.document_id,
    c.chunk_text,
    c.chunk_index,
    1 - (c.embedding <=> $1::vector) AS similarity
FROM document_chunks c
WHERE c.document_id = ANY($2)
ORDER BY c.embedding <=> $1::vector
LIMIT $3;
```

The `<=>` operator computes cosine distance. A distance of 0 means identical vectors. We subtract from 1 to convert distance to similarity, so higher numbers mean more relevant results. This approach finds semantically related content regardless of the exact words used. Search for "payment terms" and it will find chunks about "invoice due dates" and "billing cycles" because their meanings are close in the embedding space.

## RAG-Based Chat

This is the feature that makes DocuMind truly useful. RAG (Retrieval-Augmented Generation) lets users have a natural conversation with their documents. I wrote a comprehensive guide on [building RAG pipelines that actually work](/rag-that-actually-works/) covering chunking strategies, hybrid search, and evaluation in more depth. The flow is straightforward:

1. Take the user's question
2. Convert it to an embedding
3. Find the most relevant chunks via semantic search
4. Build a prompt with those chunks as context
5. Send everything to DeepSeek for a grounded answer

```go
func (s *DocumentService) Chat(ctx context.Context, docID, question string) (*ChatResponse, error) {
    // Embed the question
    queryEmbedding, err := s.ai.GenerateEmbedding(ctx, question)
    if err != nil {
        return nil, err
    }

    // Retrieve top 5 relevant chunks
    chunks, err := s.vectorDB.Search(ctx, queryEmbedding, []string{docID}, 5)
    if err != nil {
        return nil, err
    }

    // Build context from retrieved chunks
    var context strings.Builder
    for i, chunk := range chunks {
        context.WriteString(fmt.Sprintf("[Source %d] %s\n\n", i+1, chunk.Text))
    }

    systemPrompt := `You are a document assistant. Answer questions based only
on the provided context. If the answer is not in the context, say so.
Always cite which source number your answer comes from.`

    userPrompt := fmt.Sprintf("Context:\n%s\nQuestion: %s", context.String(), question)

    answer, err := s.ai.Chat(ctx, systemPrompt, userPrompt)
    if err != nil {
        return nil, err
    }

    return &ChatResponse{
        Answer:  answer,
        Sources: chunks,
    }, nil
}
```

The system prompt instructs DeepSeek to only answer from the provided context and to cite sources. This keeps the model grounded and prevents hallucination. The response includes both the answer and the source chunks so the mobile app can show users exactly where the information came from.

## The Flutter App

The mobile app is built with Flutter 3.x using GetX for state management and Domain Driven Architecture for project organization. Each feature lives in its own folder with `presentation/`, `controller/`, and `services/` subdirectories.

```
lib/
  features/
    document/
      presentation/    # screens and widgets
      controller/      # GetX controllers
      services/        # API calls and business logic
    chat/
      presentation/
      controller/
      services/
    scanner/
      presentation/
      controller/
      services/
  core/
    network/           # Dio HTTP client
    theme/             # Material 3 theming
    routes/            # GetX route management
```

The document controller manages the upload flow and processing state:

```dart
class DocumentController extends GetxController {
  final DocumentService _service = DocumentService();

  var documents = <Document>[].obs;
  var isProcessing = false.obs;
  var processingProgress = ''.obs;

  Future<void> uploadAndProcess(File file) async {
    try {
      isProcessing.value = true;

      processingProgress.value = 'Uploading document...';
      final doc = await _service.upload(file);

      processingProgress.value = 'Processing chunks and embeddings...';
      await _service.processDocument(doc.id);

      processingProgress.value = 'Generating summary...';
      await _service.generateSummary(doc.id);

      final updatedDoc = await _service.getDocument(doc.id);
      documents.add(updatedDoc);

      processingProgress.value = 'Done!';
      Get.snackbar('Success', 'Document processed and ready for chat');
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isProcessing.value = false;
    }
  }
}
```

The chat interface uses an `Obx` wrapper around a `ListView` so the UI updates reactively as new messages arrive. The document scanner feature uses the device camera to capture pages, then sends them as uploads to the backend. Material 3 theming gives the whole app a clean, modern look with dynamic color support.

## Running It Locally

The entire stack runs locally with Docker Compose for infrastructure and direct `go run` / `flutter run` for development:

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: documind
      POSTGRES_USER: documind
      POSTGRES_PASSWORD: documind
    ports:
      - "5432:5432"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
```

After `docker-compose up`, pull the embedding model with `ollama pull nomic-embed-text`, run migrations, then start the backend with `go run cmd/api/main.go`. Point the Flutter app at your local IP and run `flutter run`.

Everything stays on your machine. No data leaves your network. That was a deliberate design choice. For documents that might contain sensitive information, local-first AI is a significant advantage.

## What I Learned

**pgvector is underrated.** If you already use PostgreSQL, you do not need a separate vector database for most use cases. pgvector handles millions of vectors well and keeps your architecture simple. One database for everything.

**Ollama makes embeddings free.** Running `nomic-embed-text` locally means zero API costs for embeddings. The model is small, fast, and produces quality vectors. For a project like this where you might process hundreds of documents, the cost savings are real.

**Chunking strategy matters more than the embedding model.** I spent days comparing embedding models before realizing that my chunking strategy had a much bigger impact on search quality. Overlapping chunks, respecting paragraph boundaries, and keeping chunks at the right size made more difference than switching from one embedding model to another.

**Go is excellent for AI backends.** The Go ecosystem has solid HTTP libraries, good PostgreSQL drivers, and the concurrency model handles multiple document processing jobs well. The compiled binary deploys easily and uses minimal resources compared to Python alternatives.

## What's Next

DocuMind is a working project but there is more I want to add:

- **OCR for scanned documents** — right now it handles digital text documents. Adding Tesseract or a similar OCR engine would let it process photographed and scanned pages
- **Multi-language support** — the embedding model handles multiple languages, but the chunking and summarization prompts need adaptation
- **Web frontend with Next.js** — a browser-based interface for users who prefer desktop access

Both repositories are open source:

- Backend: [github.com/zumrywahid/documind-go](https://github.com/zumrywahid/documind-go)
- Mobile: [github.com/zumrywahid/documind-flutter](https://github.com/zumrywahid/documind-flutter)

If you are interested in building AI-powered applications with Go, or want to see how pgvector and RAG work together in practice, check out the repos. DocuMind is a good example of the kind of project an [AI Product Engineer](/what-does-ai-product-engineer-do/) ships day to day. Contributions and feedback are welcome.
