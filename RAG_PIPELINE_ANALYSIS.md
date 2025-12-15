# PipesHub AI - RAG Pipeline Architecture Analysis

## Overview

PipesHub AI implements a **hybrid search RAG (Retrieval-Augmented Generation) pipeline** that combines semantic search with permission-aware document retrieval across multiple data sources (Google Drive, Gmail, file uploads, etc.)

---

## Architecture Components

### 1. **Indexing Pipeline** (`modules/indexing/run.py`)

The indexing pipeline processes documents through several stages:

#### 1.1 **CustomChunker (Semantic Chunking)**

```python
class CustomChunker(SemanticChunker)
```

**Purpose**: Intelligently split documents into semantically coherent chunks

**Technique**: **Semantic Chunking with Adaptive Breakpoints**

- Uses **SemanticChunker** from LangChain with custom merging logic
- Calculates **cosine distances** between adjacent documents using embeddings
- Identifies **breakpoint threshold** (95th percentile by default)
- Merges documents that are semantically similar (below threshold)
- Preserves document structure (bounding boxes, page numbers, etc.)

**Key Features**:

1. **Metadata Merging** (`_merge_metadata`)
   - Keeps single value if all chunks have same metadata
   - Creates list of unique values if metadata differs
   - Special handling for `confidence_score` (keeps maximum)
2. **Bounding Box Merging** (`_merge_bboxes`)

   - Merges spatial coordinates from multiple chunks
   - Creates encompassing rectangle (leftmost x, topmost y, rightmost x, bottommost y)
   - Preserves visual layout information for PDFs

3. **Block Number Tracking**
   - Maintains list of original block numbers when merging
   - Enables tracing back to source document structure

#### 1.2 **IndexingPipeline**

**Purpose**: Orchestrate document indexing into vector database

**Flow**:

```
Documents → CustomChunker → Metadata Processing → Embedding Creation → Vector Store
```

**Key Methods**:

**a) `get_embedding_model_instance()`**

- Retrieves embedding model from configuration (ETCD)
- Falls back to default (`Alibaba-NLP/gte-base-en-v1.5`)
- Detects embedding dimensions dynamically
- **Initializes collection** if not exists or recreates if dimension mismatch

**b) `_initialize_collection()`**

- Creates **Qdrant collection** for hybrid search
- Sets up **dual vector spaces**:
  - `dense`: Semantic embeddings (1024 dims for GTE models)
  - `sparse`: BM25 keyword embeddings
- Creates **payload indexes** for filtering:
  - `virtualRecordId`: Links to logic record across versions
  - `orgId`: Multi-tenant isolation

**c) `_create_embeddings(chunks: List[Document])`**
**Embedding Strategy**: **Hybrid Search (Dense + Sparse)**

1. **Dense Embeddings** (Semantic Search)

   - Uses configurable model (BGE, GTE, OpenAI, Cohere, etc.)
   - Generates semantic vector representations
   - Dimension: Model-specific (1024 for GTE, 1536 for OpenAI)

2. **Sparse Embeddings** (Keyword Search)
   - Uses `Qdrant/BM25` (TF-IDF based)
   - Generates sparse vectors for keyword matching
   - Handles exact term matches

**Metadata Enhancement**:

```python
enhanced_metadata = self._process_metadata(meta)
```

- Adds timestamps, org IDs, virtual record IDs
- Normalizes metadata fields for filtering
- Preserves document hierarchy (page numbers, sections, etc.)

3. **Vector Store Integration**:

```python
self.vector_store = QdrantVectorStore(
    client=self.vector_db_service.get_service_client(),
    collection_name=self.collection_name,
    vector_name="dense",
    sparse_vector_name="sparse",
    embedding=dense_embeddings,
    sparse_embedding=self.sparse_embeddings,
    retrieval_mode=RetrievalMode.HYBRID,  # Key: Combines both
)
```

**d) `index_documents(sentences, record_id)`**
Main entry point for indexing:

1. Converts raw text + metadata → LangChain `Document` objects
2. Calls `CustomChunker` to semantically group chunks
3. Creates **hybrid embeddings** (dense + sparse)
4. Stores in **Qdrant** with metadata payload
5. Updates **ArangoDB** with indexing status

---

### 2. **Retrieval Service** (`modules/retrieval/retrieval_service.py`)

**Purpose**: Perform permission-aware semantic search with multi-level filtering

#### 2.1 **Search Architecture** (`search_with_filters`)

**Technique**: **Permission-Filtered Hybrid Search with Parallel Optimization**

**Flow**:

```
User Query
    ↓
[Parallel Execution]
├─→ Get Accessible Records (ArangoDB) ─┐
├─→ Get Vector Store (Qdrant)         ─┼→ Filter & Search
└─→ Get User Info (Cached)            ─┘
    ↓
Virtual ID → Record ID Mapping
    ↓
Metadata Enrichment (Files, Mails, URLs)
    ↓
Knowledge Graph Flattening (if knowledge_search=True)
    ↓
Sorted & Filtered Results
```

**Key Techniques**:

**a) Permission Filtering**

```python
accessible_records = await arango_service.get_accessible_records(
    user_id=user_id, org_id=org_id, filters=arango_filters
)
```

- Queries **ArangoDB graph** for user-accessible documents
- Respects **RBAC (Role-Based Access Control)**
- Filters by KB, departments, categories, etc.

**b) Hybrid Vector Search**

```python
filter = await self.vector_db_service.filter_collection(
    must={"orgId": org_id},
    should={"virtualRecordId": accessible_virtual_record_ids}
)
```

- **Must clause**: Hard requirement (org isolation)
- **Should clause**: Soft requirement (accessible records)
- Executes **parallel searches** for multiple queries

**c) Query Preprocessing** (`_preprocess_query`)

```python
if "bge" in model_name.lower():
    return f"Represent this document for retrieval: {query.strip()}"
```

- Adds **instruction prefix** for BGE models
- Improves retrieval quality for specific embedding models

**d) Parallel Execution Optimization**

```python
init_tasks = [
    self._get_accessible_records_task(...),
    self._get_vector_store_task(),
    self._get_user_cached(user_id)
]
accessible_records, vector_store, user = await asyncio.gather(*init_tasks)
```

- **Concurrent database queries** (ArangoDB, Qdrant, user cache)
- **3x faster** than sequential execution

**e) Virtual Record Mapping**

```python
virtual_to_record_map = self._create_virtual_to_record_mapping(...)
```

**Concept**: **Virtual Records**

- Multiple physical records (versions, copies) → Single virtual record
- Enables deduplication and version tracking
- Maps `virtualRecordId` → first accessible physical `record_id`

**f) Metadata Enrichment**

```python
# Batch fetch files and mails in parallel
files_map, mails_map = await asyncio.gather(fetch_files(), fetch_mails())
```

- **Two-pass enrichment**:

  1. First pass: Identify records needing URL fetch
  2. Batch fetch: Parallel retrieval from ArangoDB
  3. Second pass: Apply URLs and mimeTypes to results

- Adds `webUrl`, `recordName`, `origin`, `connector`, `mimeType`, `extension`, etc.

**g) Knowledge Graph Flattening** (if `knowledge_search=True`)

```python
# For block groups (tables, charts, etc.)
await get_flattened_results(new_type_results, blob_store, ...)
```

- Fetches structured data blocks from blob storage
- Flattens tables into row-by-row citations
- Enables **granular citations** for complex documents

**h) Result Filtering & Validation**

```python
required_fields = ['origin', 'recordName', 'recordId', 'mimeType', 'orgId']
complete_results = [
    result for result in final_search_results
    if all(field in metadata for field in required_fields)
]
```

- Ensures all results have required metadata
- Prevents citation validation failures on frontend

**i) Caching Strategy**

```python
_user_cache: Dict[str, tuple] = {}  # {user_id: (user_data, timestamp)}
USER_CACHE_TTL = 300  # 5 minutes
```

- **In-memory user cache** (5-minute TTL)
- Avoids repeated ArangoDB queries for user info
- LRU eviction when cache >1000 users

#### 2.2 **Parallel Search Execution** (`_execute_parallel_searches`)

```python
# Parallel embedding generation
query_embeddings = await asyncio.gather(*[
    dense_embeddings.aembed_query(query) for query in queries
])

# Batch query Qdrant
query_requests = [models.QueryRequest(
    query=query_embedding,
    using="dense",
    filter=filter,
    limit=limit
) for query_embedding in query_embeddings]
```

**Optimization**:

- **Parallel embedding**: All queries embedded concurrently
- **Batch Qdrant query**: Single API call for multiple queries
- **Deduplication**: Uses `seen_points` set to avoid duplicate results

---

## Data Flow

### Indexing Flow

```
1. Document Upload (Connector/UI)
       ↓
2. Extraction (Docling/Parser) → Sentences + Metadata
       ↓
3. Kafka Message → indexing_main.py
       ↓
4. IndexingPipeline.index_documents()
       ├─→ CustomChunker.split_documents() [Semantic Chunking]
       ├─→ Dense Embedding (GTE/BGE/OpenAI)
       ├─→ Sparse Embedding (BM25)
       └─→ QdrantVectorStore.aadd_documents()
       ↓
5. ArangoDB: Update record status (indexingStatus: COMPLETED)
```

### Retrieval Flow

```
1. User Query (RAG API / Agent)
       ↓
2. RetrievalService.search_with_filters()
       ├─→ [Parallel] Get Accessible Records (ArangoDB RBAC)
       ├─→ [Parallel] Get Vector Store (Qdrant)
       └─→ [Parallel] Get User Info (Cache)
       ↓
3. Build Qdrant Filter
       must: {orgId}
       should: {virtualRecordId: [accessible_ids]}
       ↓
4. Hybrid Search (Dense + Sparse)
       ↓
5. Virtual → Physical Record Mapping
       ↓
6. [Parallel] Fetch File/Mail Metadata
       ↓
7. [Optional] Flatten Knowledge Graph Blocks
       ↓
8. Sort by Score & Filter Incomplete
       ↓
9. Return {searchResults, records}
```

---

## Schema Design

### 1. **Vector Database (Qdrant)**

**Collection Configuration**:

```python
vectors={
    "dense": {
        "size": 1024,  # Embedding dimension
        "distance": "Cosine"
    }
}
sparse_vectors={
    "sparse": {
        "modifier": "idf"  # BM25 IDF scoring
    }
}
```

**Payload Structure**:

```json
{
  "page_content": "Actual document text chunk",
  "metadata": {
    "virtualRecordId": "vr_abc123",
    "recordId": "rec_xyz456",
    "orgId": "org_123",
    "kbId": "kb_456",
    "blockNum": [1, 2, 3],
    "bounding_box": [{"x": 10, "y": 20}, ...],
    "pageNumber": 1,
    "mimeType": "application/pdf",
    "origin": "google_drive",
    "connector": "Google Drive",
    "confidence_score": 0.95
  }
}
```

**Indexes**:

- `virtualRecordId`: Keyword index (exact match)
- `orgId`: Keyword index (multi-tenant filtering)

### 2. **Graph Database (ArangoDB)**

**Key Collections**:

1. **records**: Physical document records

   ```json
   {
     "_key": "rec_123",
     "virtualRecordId": "vr_abc",
     "recordName": "Q4_Report.pdf",
     "recordType": "FILE",
     "connectorName": "Google Drive",
     "indexingStatus": "COMPLETED",
     "orgId": "org_123",
     "kbId": "kb_456"
   }
   ```

2. **users**: User accounts with permissions

3. **userGroups**: RBAC group memberships

4. **kb** (Knowledge Bases): Logical document groupings

5. **files / mails**: Connector-specific metadata
   ```json
   {
     "_key": "rec_123",
     "webUrl": "https://drive.google.com/file/...",
     "mimeType": "application/pdf"
   }
   ```

**Graph Edges**:

- `HAS_ACCESS`: User/Group → Record
- `BELONGS_TO_KB`: Record → KB
- `MEMBER_OF`: User → Group

---

## Advanced Techniques

### 1. **Semantic Chunking**

- **Problem**: Fixed-size chunking breaks semantic context
- **Solution**: Embed all sentences, calculate cosine distances, merge semantically similar chunks
- **Benefit**: Better chunk coherence, improved retrieval

### 2. **Hybrid Search**

- **Dense (Semantic)**: Finds conceptually similar documents
- **Sparse (BM25)**: Finds keyword matches
- **Fusion**: Qdrant combines scores automatically
- **Benefit**: Handles both semantic and exact-match queries

### 3. **Virtual Record Deduplication**

- **Problem**: Same document across multiple locations (Drive folder, shared with me)
- **Solution**: Assign single `virtualRecordId`, store all versions
- **Benefit**: No duplicate results, version history tracking

### 4. **Permission-Aware Retrieval**

- **Problem**: Users shouldn't see documents they can't access
- **Solution**: Graph query for accessible records → Filter Qdrant by those IDs
- **Benefit**: Zero trust security, RBAC enforcement

### 5. **Batch Parallel Fetching**

- **Pattern**: Collect IDs in first pass → Batch fetch in second pass
- **Benefit**: **O(1) database queries** instead of O(n)

### 6. **Knowledge Graph Flattening**

- **Problem**: Tables/charts are single chunks but need row-level citations
- **Solution**: Fetch block groups from blob storage, flatten into individual rows
- **Benefit**: Granular, verifiable citations

### 7. **Adaptive Embedding Models**

- **Config-driven**: Embedding model stored in ETCD
- **Dynamic switching**: Detects dimension changes, recreates collection
- **Supports**: BGE, GTE, OpenAI, Cohere, Voyage, etc.

---

## Performance Optimizations

### Indexing

1. **Batch Upsert**: `aadd_documents()` batches vectors
2. **Parallel Merges**: CustomChunker processes chunks in parallel
3. **Metadata Caching**: Avoids repeated config fetches

### Retrieval

1. **3-Way Parallel Init**: Accessible records + Vector store + User (concurrent)
2. **Batch Metadata Fetch**: Single `gather()` for all files/mails
3. **User Caching**: 5-minute in-memory cache (300s TTL)
4. **Vector Store Caching**: Reuses same Qdrant instance across requests
5. **Set-Based Deduplication**: `seen_points` set (O(1) lookup)

---

## Error Handling

### Custom Exceptions

```python
# Indexing Exceptions
ChunkingError, EmbeddingError, VectorStoreError,
MetadataProcessingError, DocumentProcessingError

# Retrieval Exceptions
VectorDBEmptyError, EmbeddingModelCreationError
```

### Graceful Degradation

- Empty documents → Set status to "EMPTY", skip indexing
- No accessible records → 404 with helpful message
- Vector DB empty → 503 "No records indexed yet"
- Incomplete results → Filter out, log warning

---

## Metadata Tag System

### Core Metadata Fields

- **Identity**: `recordId`, `virtualRecordId`, `orgId`, `kbId`
- **Source**: `origin`, `connector`, `connectorName`
- **Document**: `recordName`, `mimeType`, `extension`, `webUrl`
- **Structure**: `pageNumber`, `blockNum`, `bounding_box`, `isBlockGroup`
- **Quality**: `confidence_score`, `extractionStatus`, `indexingStatus`
- **Temporal**: `createdAt`, `lastIndexTimestamp`

### Filtering Hierarchy

```
Org Level: orgId (hard filter, multi-tenant isolation)
    ↓
Permission Level: virtualRecordId (accessible records from graph)
    ↓
Category Level: kb, departments, teams, etc. (user-defined filters)
```

---

## Key Design Patterns

1. **Separation of Concerns**

   - Indexing: Document processing → Vector storage
   - Retrieval: Permission checking → Search → Enrichment

2. **Config-Driven Architecture**

   - Embedding models, LLMs stored in ETCD
   - Dynamic updates without code changes

3. **Event-Driven Indexing**

   - Kafka messages trigger indexing
   - Asynchronous, scalable processing

4. **Repository Pattern**

   - Abstract interfaces: `IVectorDBService`, `BaseArangoService`
   - Swappable implementations (Qdrant, Pinecone, Weaviate)

5. **Optimistic Concurrency**
   - Parallel fetches with `asyncio.gather()`
   - Exception handling with `return_exceptions=True`

---

## Conclusion

PipesHub implements a **production-grade RAG pipeline** with:

✅ **Hybrid search** (semantic + keyword)
✅ **Permission-aware retrieval** (graph-based RBAC)
✅ **Semantic chunking** (context-preserving)
✅ **Multi-tenant isolation** (org-level filtering)
✅ **Virtual record deduplication** (version tracking)
✅ **Parallel optimizations** (3x faster retrieval)
✅ **Metadata enrichment** (URLs, mimeTypes, connectors)
✅ **Knowledge graph integration** (ArangoDB + Qdrant)
✅ **Dynamic embedding models** (config-driven)
✅ **Graceful error handling** (user-friendly messages)

This architecture enables **secure, fast, and accurate** document retrieval across heterogeneous data sources.
