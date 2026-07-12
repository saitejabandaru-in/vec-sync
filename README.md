# ⚡ Vector DB Sync Gateway

<p align="center">
  <img src="https://img.shields.io/badge/docker-container-blue.svg?style=flat-square&logo=docker" alt="Docker Container" />
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg?style=flat-square&logo=node.js" alt="Node Version" />
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" />
</p>

`vector-sync` is a containerized, high-performance **Vector Database Migration & Synchronization Gateway** built for AI agencies and enterprise teams. It provides a simple, self-hostable control panel to stream, batch-migrate, and sync vector embeddings and metadata payloads between different Vector Search engines (such as Qdrant and ChromaDB) without writing custom scripts.

---

## ⚡ Core Framework Features

| Feature | Description | Business Benefit for AI Agencies |
| :--- | :--- | :--- |
| **📦 Docker Ready** | Multi-stage built, tiny alpine container footprint. | Deployable locally or on any cloud (AWS, GCP, Render) in seconds. |
| **📈 Live Speed Analytics** | Built-in Chart.js throughput graph showing vectors/sec. | Helps identify downstream write bottlenecks and track execution ETA. |
| **🛠️ Multiple Connectors** | Ready-made connectors for Qdrant, ChromaDB, and Memory. | **Avoids database lock-in** when migrating clients to cheaper hosts. |
| **⚡ Streaming Batches** | Stream vectors in memory-efficient batches with page scrolling. | Migrates millions of vectors safely without causing out-of-memory errors. |
| **📟 Log Console** | Terminal-style logs inside the UI to monitor execution batch-by-batch. | Fully transparent debugging and progress tracking. |

---

## 🚀 Quick Start (Docker)

Spin up the gateway locally using Docker:

```bash
docker run -d -p 3000:3000 ghcr.io/saitejabandaru-in/vector-sync:latest
```

Open your browser and navigate to:
🔗 **`http://localhost:3000`**

---

## 🛠️ Step-by-Step Migration Guide

1. **Configure Connection**: Enter the endpoint URLs for your Source Database (e.g. Chroma) and Target Database (e.g. Qdrant).
2. **Fetch Collections**: Click **Fetch** to automatically scan the source endpoint and populate the collections dropdown.
3. **Set Destination Name**: Specify the target collection name.
4. **Execute**: Click **Start Migration** and watch the live progress bar, throughput speed graph, and raw batch logs populate in real-time.

---

## 📟 REST API Endpoints

The gateway exposes a simple REST API to trigger migrations programmatically:

### 1. Start Migration
* **Endpoint**: `POST /api/migrate/start`
* **Body**:
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
  "batchSize": 50
}
```

### 2. Check Migration Progress
* **Endpoint**: `GET /api/migrate/status`
* **Response**:
```json
{
  "collectionName": "source-embeddings",
  "completed": 2500,
  "status": "RUNNING",
  "rate": 120.5,
  "elapsedSeconds": 20.7,
  "etaSeconds": 15
}
```

---

## 📄 License
MIT License.
