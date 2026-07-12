import { VectorDBConnector, VectorRecord } from "./base";

export class MemoryConnector extends VectorDBConnector {
    private db: Record<string, VectorRecord[]> = {};

    async connect(connectionString: string, apiKey?: string): Promise<void> {
        this.connectionString = connectionString;
        this.apiKey = apiKey;
        
        // If "seed" is in connection string, populate with mock vector records
        if (connectionString.includes("seed")) {
            const mockRecords: VectorRecord[] = [];
            for (let i = 0; i < 50; i++) {
                // 128 dimensional embeddings
                const vec = Array.from({ length: 128 }, () => Math.random() * 2.0 - 1.0);
                mockRecords.push({
                    id: `vec-${i}`,
                    vector: vec,
                    payload: {
                        text: `This is text document number ${i}`,
                        category: i % 2 === 0 ? "news" : "sports",
                        timestamp: Date.now()
                    }
                });
            }
            this.db["default-collection"] = mockRecords;
        }
    }

    async getCollections(): Promise<string[]> {
        return Object.keys(this.db);
    }

    async readVectors(
        collectionName: string,
        limit: number,
        offset: number
    ): Promise<VectorRecord[]> {
        const list = this.db[collectionName] || [];
        return list.slice(offset, offset + limit);
    }

    async upsertVectors(
        collectionName: string,
        vectors: VectorRecord[]
    ): Promise<void> {
        if (!this.db[collectionName]) {
            this.db[collectionName] = [];
        }
        
        const existing = this.db[collectionName];
        for (const record of vectors) {
            const idx = existing.findIndex(r => r.id === record.id);
            if (idx !== -1) {
                existing[idx] = record;
            } else {
                existing.push(record);
            }
        }
    }

    async disconnect(): Promise<void> {
        // No-op
    }

    // Helper to get raw storage length for testing
    public getCollectionCount(collectionName: string): number {
        return (this.db[collectionName] || []).length;
    }
}
