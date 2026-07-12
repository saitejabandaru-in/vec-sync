import express, { Request, Response } from "express";
import * as path from "path";
import { MigrationOrchestrator, MigrationProgress } from "./migrator";
import { MemoryConnector } from "./connectors/memory";
import { QdrantConnector } from "./connectors/qdrant";
import { ChromaConnector } from "./connectors/chroma";
import { VectorDBConnector } from "./connectors/base";

const app = express();
app.use(express.json());

// Serve static dashboard files
app.use(express.static(path.join(__dirname, "..", "public")));

const orchestrator = new MigrationOrchestrator();
let currentProgress: MigrationProgress = {
    collectionName: "",
    completed: 0,
    status: "IDLE",
    rate: 0,
    elapsedSeconds: 0,
    etaSeconds: -1
};

function getConnector(dbType: string): VectorDBConnector {
    switch (dbType.toLowerCase()) {
        case "memory":
            return new MemoryConnector();
        case "qdrant":
            return new QdrantConnector();
        case "chroma":
            return new ChromaConnector();
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

/**
 * Retrieve collections/indexes for a given connection config.
 */
app.post("/api/collections", async (req: Request, res: Response) => {
    const { dbType, connectionString, apiKey } = req.body;
    
    if (!dbType || !connectionString) {
        res.status(400).json({ error: "Missing required parameters: dbType and connectionString" });
        return;
    }

    try {
        const connector = getConnector(dbType);
        await connector.connect(connectionString, apiKey);
        const collections = await connector.getCollections();
        await connector.disconnect();
        res.json({ collections });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Trigger the vector database migration process.
 */
app.post("/api/migrate/start", async (req: Request, res: Response) => {
    const {
        sourceDb,
        targetDb,
        collectionName,
        targetCollectionName,
        batchSize,
        concurrency,
        transformScript,
        reEmbedConfig
    } = req.body;

    if (!sourceDb || !targetDb || !collectionName) {
        res.status(400).json({ error: "Missing required config parameters" });
        return;
    }

    const current = orchestrator.getStatus();
    if (current && current.status === "RUNNING") {
        res.status(400).json({ error: "Another migration is already running" });
        return;
    }

    // Run asynchronously to allow status polling
    (async () => {
        let sourceConnector: VectorDBConnector | null = null;
        let targetConnector: VectorDBConnector | null = null;

        try {
            sourceConnector = getConnector(sourceDb.type);
            targetConnector = getConnector(targetDb.type);

            await sourceConnector.connect(sourceDb.connectionString, sourceDb.apiKey);
            await targetConnector.connect(targetDb.connectionString, targetDb.apiKey);

            await orchestrator.migrate({
                sourceConnector,
                targetConnector,
                collectionName,
                targetCollectionName: targetCollectionName || collectionName,
                batchSize: batchSize ? parseInt(batchSize, 10) : 25,
                concurrency: concurrency ? parseInt(concurrency, 10) : 4,
                transformScript,
                reEmbedConfig,
                onProgress: (p) => {
                    currentProgress = p;
                }
            });

        } catch (err: any) {
            currentProgress = {
                collectionName,
                completed: currentProgress.completed,
                status: "FAILED",
                error: err.message,
                rate: 0,
                elapsedSeconds: 0,
                etaSeconds: -1
            };
        } finally {
            if (sourceConnector) await sourceConnector.disconnect();
            if (targetConnector) await targetConnector.disconnect();
        }
    })();

    res.json({ status: "STARTED" });
});

/**
 * Retrieve active migration status.
 */
app.get("/api/migrate/status", (req: Request, res: Response) => {
    res.json(currentProgress);
});

/**
 * Abort running migration.
 */
app.post("/api/migrate/abort", (req: Request, res: Response) => {
    orchestrator.abort();
    res.json({ status: "ABORTED" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Vector DB Sync Gateway listening on port ${PORT}...`);
});
