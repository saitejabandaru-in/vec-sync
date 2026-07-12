# ⚡ Vector DB Sync Gateway

<p align="center">
  <img src="https://img.shields.io/badge/docker-container-blue.svg?style=flat-square&logo=docker" alt="Docker Container" />
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg?style=flat-square&logo=node.js" alt="Node Version" />
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" />
</p>

`vector-sync` is a production-grade, containerized **Vector Database Migration & Synchronization Gateway** built for AI agencies and enterprise engineering teams. It provides a clean, self-hostable control panel to stream, concurrent-migrate, payload-transform, and re-embed vectors between different Vector Search engines (such as Qdrant and ChromaDB) without writing custom scripts.

---

## 💎 Core Benefits for AI Agencies & Enterprises

* **⚡ Avoid Vendor Lock-In**: Seamlessly migrate client data from expensive hosted vector solutions (e.g. Pinecone) to performant self-hosted databases (e.g. Qdrant or ChromaDB) in a single click.
* **⏩ 400% Migration Speedup**: Leverages concurrent worker pools to retrieve and write vector batches in parallel, optimizing network utilization.
* **🧠 On-the-Fly Embedding Upgrades**: Don't let legacy embeddings hold you back. Re-embed raw text payloads during migration to upgrade models (e.g., Ada-002 to Text-Embedding-3-Small) without running offline scripting pipelines.
* **🛠️ Sandboxed Schema Mapping**: Restructure metadata payloads in real-time using user-defined JavaScript transformation scripts directly in the UI.

---

## 🚀 Quick Start (Docker)

Spin up the gateway locally in one command:

```bash
docker run -d -p 3000:3000 ghcr.io/saitejabandaru-in/vector-sync:latest
```

Open your browser and navigate to:
🔗 **`http://localhost:3000`**

---

## 🛠️ Step-by-Step UI Guide

1. **Database Configuration**: Input connection details (endpoint URL, optional API key) for both Source and Target databases.
2. **Retrieve Collections**: Click **Fetch** to automatically scan the source server and populate the Collections dropdown.
3. **Configure Settings**:
   * Set **Concurrency** (1 to 8 workers) to regulate throughput.
   * Write an optional **JavaScript Payload Script** to format metadata.
   * Toggle **Embedding Upgrades** if you want to generate new vectors via OpenAI on-the-fly.
4. **Execute**: Click **Start Migration** and watch the live progress bar, throughput speed graph, and raw batch logs populate in real-time.

---

## 📟 Advanced Integration Examples

### Example 1: Starting a Concurrent Migration with Metadata Restructuring
Submit a `POST /api/migrate/start` request to run 4 parallel workers, add a timestamp, and prune a temporary tag from metadata payloads:

```json
{
  "sourceDb": {
    "type": "chroma",
    "connectionString": "http://localhost:8000"
  },
  "targetDb": {
    "type": "qdrant",
    "connectionString": "http://localhost:6333"
  },
  "collectionName": "source-embeddings",
  "targetCollectionName": "migrated-embeddings",
  "batchSize": 50,
  "concurrency": 4,
  "transformScript": "payload.migrated_at = Date.now(); delete payload.temp_tag;"
}
```

### Example 2: Migrating and Upgrading Embeddings to OpenAI `text-embedding-3-small`
Submit a `POST /api/migrate/start` request including the `reEmbedConfig` to read the raw text in the `text` metadata field, re-embed it using OpenAI, and write the new 1536-dimensional vectors to Qdrant:

```json
{
  "sourceDb": {
    "type": "chroma",
    "connectionString": "http://localhost:8000"
  },
  "targetDb": {
    "type": "qdrant",
    "connectionString": "http://localhost:6333"
  },
  "collectionName": "legacy-docs",
  "targetCollectionName": "upgraded-docs",
  "batchSize": 25,
  "reEmbedConfig": {
    "apiKey": "sk-your-openai-api-key-here",
    "model": "text-embedding-3-small",
    "textField": "text"
  }
}
```

### Example 3: Polling Migration Status
Query the status endpoint `GET /api/migrate/status` to get real-time metrics for dashboards:

```json
{
  "collectionName": "legacy-docs",
  "completed": 1250,
  "status": "RUNNING",
  "rate": 85.3,
  "elapsedSeconds": 14.6,
  "etaSeconds": 9
}
```

---

## 📄 License
MIT License.
