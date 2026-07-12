import { VectorDBConnector, VectorRecord } from "./connectors/base";
import { EmbeddingTransformer } from "./transformer";

export interface ReEmbedConfig {
    apiKey: string;
    model: string;
    textField: string;
}

export interface MigrationOptions {
    sourceConnector: VectorDBConnector;
    targetConnector: VectorDBConnector;
    collectionName: string;
    targetCollectionName?: string;
    batchSize?: number;
    concurrency?: number;
    transformScript?: string;
    reEmbedConfig?: ReEmbedConfig;
    onProgress?: (progress: MigrationProgress) => void;
}

export interface MigrationProgress {
    collectionName: string;
    completed: number;
    status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
    error?: string;
    rate: number; // vectors/sec
    elapsedSeconds: number;
    etaSeconds: number;
}

export class MigrationOrchestrator {
    private activeMigration: MigrationProgress | null = null;
    private shouldStop: boolean = false;
    private transformer: EmbeddingTransformer = new EmbeddingTransformer();

    /**
     * Executes the vector migration from source to target.
     */
    public async migrate(options: MigrationOptions): Promise<MigrationProgress> {
        const {
            sourceConnector,
            targetConnector,
            collectionName,
            targetCollectionName = collectionName,
            batchSize = 25,
            concurrency = 4,
            transformScript,
            reEmbedConfig,
            onProgress
        } = options;

        this.shouldStop = false;
        const startTime = Date.now();
        
        const progress: MigrationProgress = {
            collectionName,
            completed: 0,
            status: "RUNNING",
            rate: 0,
            elapsedSeconds: 0,
            etaSeconds: -1
        };
        this.activeMigration = progress;

        // Parse custom JS payload transformer function
        let transformFn: ((payload: Record<string, any>) => Record<string, any>) | null = null;
        if (transformScript && transformScript.trim()) {
            try {
                transformFn = new Function("payload", `${transformScript}; return payload;`) as any;
            } catch (err: any) {
                throw new Error(`Failed to compile JavaScript transform function: ${err.message}`);
            }
        }

        try {
            // Determine if the source DB supports numeric offsets (enabling concurrency)
            // Memory and Chroma support numeric offsets; Qdrant scroll is cursor-based.
            const isQdrant = sourceConnector.constructor.name === "QdrantConnector";
            
            if (isQdrant) {
                // Sequential fallback for Qdrant cursor paging
                let offset: string | number = "";
                let hasMore = true;

                while (hasMore && !this.shouldStop) {
                    const batch: VectorRecord[] = await sourceConnector.readVectors(
                        collectionName,
                        batchSize,
                        offset as any
                    );

                    if (batch.length === 0) {
                        hasMore = false;
                        break;
                    }

                    const processedBatch = await this._processBatch(batch, transformFn, reEmbedConfig);
                    await targetConnector.upsertVectors(targetCollectionName, processedBatch);

                    progress.completed += processedBatch.length;
                    
                    const elapsedMs = Date.now() - startTime;
                    progress.elapsedSeconds = Math.max(0.1, elapsedMs / 1000.0);
                    progress.rate = progress.completed / progress.elapsedSeconds;

                    offset = batch[batch.length - 1].id; // cursor key
                    
                    if (onProgress) onProgress({ ...progress });
                    if (batch.length < batchSize) hasMore = false;
                }
            } else {
                // Multi-threaded concurrent worker execution
                let nextOffset = 0;
                let hasMore = true;
                let activeWorkers = 0;

                const runWorker = async () => {
                    activeWorkers++;
                    while (hasMore && !this.shouldStop) {
                        // Mutex-like check to reserve offset block
                        const currentOffset = nextOffset;
                        nextOffset += batchSize;

                        let batch: VectorRecord[];
                        try {
                            batch = await sourceConnector.readVectors(collectionName, batchSize, currentOffset);
                        } catch (err: any) {
                            throw new Error(`Source read failed at offset ${currentOffset}: ${err.message}`);
                        }

                        if (batch.length === 0) {
                            hasMore = false;
                            break;
                        }

                        const processedBatch = await this._processBatch(batch, transformFn, reEmbedConfig);
                        
                        try {
                            await targetConnector.upsertVectors(targetCollectionName, processedBatch);
                        } catch (err: any) {
                            throw new Error(`Target upsert failed: ${err.message}`);
                        }

                        progress.completed += processedBatch.length;
                        
                        const elapsedMs = Date.now() - startTime;
                        progress.elapsedSeconds = Math.max(0.1, elapsedMs / 1000.0);
                        progress.rate = progress.completed / progress.elapsedSeconds;

                        if (onProgress) onProgress({ ...progress });
                        if (batch.length < batchSize) {
                            hasMore = false;
                        }
                    }
                    activeWorkers--;
                };

                // Launch workers concurrently
                const workers: Promise<void>[] = [];
                const maxWorkers = Math.max(1, concurrency);
                for (let w = 0; w < maxWorkers; w++) {
                    workers.push(runWorker());
                }

                await Promise.all(workers);
            }

            if (this.shouldStop) {
                progress.status = "FAILED";
                progress.error = "Migration aborted by user";
            } else {
                progress.status = "COMPLETED";
                progress.etaSeconds = 0;
            }

        } catch (err: any) {
            progress.status = "FAILED";
            progress.error = err.message;
        }

        if (onProgress) {
            onProgress({ ...progress });
        }

        this.activeMigration = null;
        return progress;
    }

    /**
     * Processes a batch of records (runs JS mapping and calls OpenAI re-embeddings)
     */
    private async _processBatch(
        batch: VectorRecord[],
        transformFn: ((p: any) => any) | null,
        reEmbedConfig?: ReEmbedConfig
    ): Promise<VectorRecord[]> {
        const processedBatch: VectorRecord[] = [];
        for (const record of batch) {
            let processed = { ...record, payload: { ...record.payload } };
            
            // 1. JS Mappings
            if (transformFn) {
                try {
                    processed.payload = transformFn(processed.payload);
                } catch (e: any) {
                    throw new Error(`Payload Transformation script failed on vector ${record.id}: ${e.message}`);
                }
            }
            
            // 2. OpenAI Re-embeddings
            if (reEmbedConfig && reEmbedConfig.apiKey && reEmbedConfig.model && reEmbedConfig.textField) {
                processed = await this.transformer.reEmbedRecord(
                    processed,
                    reEmbedConfig.apiKey,
                    reEmbedConfig.model,
                    reEmbedConfig.textField
                );
            }
            processedBatch.push(processed);
        }
        return processedBatch;
    }

    /**
     * Stop active migration
     */
    public abort(): void {
        this.shouldStop = true;
    }

    public getStatus(): MigrationProgress | null {
        return this.activeMigration;
    }
}
