import axios, { AxiosInstance } from "axios";
import { VectorDBConnector, VectorRecord } from "./base";

export class ChromaConnector extends VectorDBConnector {
    private client!: AxiosInstance;
    private collectionIds: Record<string, string> = {};

    async connect(connectionString: string, apiKey?: string): Promise<void> {
        this.connectionString = connectionString.replace(/\/$/, "");
        this.apiKey = apiKey;

        const headers: Record<string, string> = {
            "Content-Type": "application/json"
        };
        if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
        }

        this.client = axios.create({
            baseURL: this.connectionString,
            headers,
            timeout: 10000
        });

        // Initialize collection IDs cache
        await this.refreshCollectionIds();
    }

    private async refreshCollectionIds(): Promise<void> {
        try {
            const response = await this.client.get("/api/v1/collections");
            const collections = response.data || [];
            this.collectionIds = {};
            for (const col of collections) {
                this.collectionIds[col.name] = col.id;
            }
        } catch (err: any) {
            throw new Error(`Failed to retrieve Chroma collections: ${err.message}`);
        }
    }

    async getCollections(): Promise<string[]> {
        await this.refreshCollectionIds();
        return Object.keys(this.collectionIds);
    }

    private getCollectionId(name: string): string {
        const id = this.collectionIds[name];
        if (!id) {
            throw new Error(`Collection "${name}" not found in Chroma`);
        }
        return id;
    }

    async readVectors(
        collectionName: string,
        limit: number,
        offset: number
    ): Promise<VectorRecord[]> {
        const id = this.getCollectionId(collectionName);
        
        const response = await this.client.post(`/api/v1/collections/${id}/get`, {
            limit,
            offset,
            include: ["embeddings", "metadatas", "documents"]
        });

        const data = response.data;
        if (!data || !data.ids) return [];

        const records: VectorRecord[] = [];
        for (let i = 0; i < data.ids.length; i++) {
            records.push({
                id: data.ids[i],
                vector: data.embeddings ? data.embeddings[i] : [],
                payload: {
                    ...(data.metadatas ? data.metadatas[i] : {}),
                    document: data.documents ? data.documents[i] : undefined
                }
            });
        }
        return records;
    }

    async upsertVectors(
        collectionName: string,
        vectors: VectorRecord[]
    ): Promise<void> {
        let id: string;
        try {
            id = this.getCollectionId(collectionName);
        } catch {
            // Collection doesn't exist, create it
            const createResponse = await this.client.post("/api/v1/collections", {
                name: collectionName,
                metadata: {}
            });
            id = createResponse.data.id;
            this.collectionIds[collectionName] = id;
        }

        const ids = vectors.map(v => v.id);
        const embeddings = vectors.map(v => v.vector);
        const metadatas = vectors.map(v => {
            const copy = { ...v.payload };
            delete copy.document; // Chroma takes document separately
            return copy;
        });
        const documents = vectors.map(v => v.payload.document || "");

        await this.client.post(`/api/v1/collections/${id}/upsert`, {
            ids,
            embeddings,
            metadatas,
            documents: documents.some(d => d) ? documents : undefined
        });
    }

    async disconnect(): Promise<void> {
        // No-op
    }
}
