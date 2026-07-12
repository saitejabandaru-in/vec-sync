import { VectorDBConnector, VectorRecord } from "./connectors/base";

export interface MigrationOptions {
    sourceConnector: VectorDBConnector;
    targetConnector: VectorDBConnector;
    collectionName: string;
    targetCollectionName?: string;
    batchSize?: number;
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

        try {
            let offset: number | string = 0;
            let hasMore = true;

            while (hasMore && !this.shouldStop) {
                // 1. Fetch batch from source
                const batch: VectorRecord[] = await sourceConnector.readVectors(
                    collectionName,
                    batchSize,
                    offset as any
                );

                if (batch.length === 0) {
                    hasMore = false;
                    break;
                }

                // 2. Push batch to target
                await targetConnector.upsertVectors(targetCollectionName, batch);

                // 3. Update progress
                progress.completed += batch.length;
                
                // Calculate elapsed time and rates
                const elapsedMs = Date.now() - startTime;
                progress.elapsedSeconds = Math.max(0.1, elapsedMs / 1000.0);
                progress.rate = progress.completed / progress.elapsedSeconds;
                
                // Qdrant paginates using the ID of the last element or string cursor
                if (typeof offset === "string") {
                    offset = batch[batch.length - 1].id;
                } else {
                    offset = (offset as number) + batch.length;
                }

                if (onProgress) {
                    onProgress({ ...progress });
                }

                if (batch.length < batchSize) {
                    hasMore = false;
                }
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
     * Stop active migration
     */
    public abort(): void {
        this.shouldStop = true;
    }

    public getStatus(): MigrationProgress | null {
        return this.activeMigration;
    }
}
