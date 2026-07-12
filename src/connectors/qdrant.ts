import axios, { AxiosInstance } from "axios";
import { VectorDBConnector, VectorRecord } from "./base";

export class QdrantConnector extends VectorDBConnector {
    private client!: AxiosInstance;

    async connect(connectionString: string, apiKey?: string): Promise<void> {
        this.connectionString = connectionString.replace(/\/$/, ""); // Strip trailing slash
        this.apiKey = apiKey;
        
        const headers: Record<string, string> = {
            "Content-Type": "application/json"
        };
        if (apiKey) {
            headers["api-key"] = apiKey;
        }

        this.client = axios.create({
            baseURL: this.connectionString,
            headers,
            timeout: 10000
        });
    }

    async getCollections(): Promise<string[]> {
        const response = await this.client.get("/collections");
        const collections = response.data.result?.collections || [];
        return collections.map((c: any) => c.name);
    }

    async readVectors(
        collectionName: string,
        limit: number,
        offset: number | string // Qdrant scroll takes next_page_offset as offset (can be string or number)
    ): Promise<VectorRecord[]> {
        // We use scroll endpoint which is the recommended way to export points
        const payload = {
            limit,
            offset: offset || null,
            with_payload: true,
            with_vector: true
        };

        const response = await this.client.post(`/collections/${collectionName}/points/scroll`, payload);
        const points = response.data.result?.points || [];

        return points.map((p: any) => ({
            id: p.id,
            vector: p.vector,
            payload: p.payload || {}
        }));
    }

    async upsertVectors(
        collectionName: string,
        vectors: VectorRecord[]
    ): Promise<void> {
        const points = vectors.map(v => ({
            id: v.id,
            vector: v.vector,
            payload: v.payload
        }));

        await this.client.put(`/collections/${collectionName}/points?wait=true`, {
            points
        });
    }

    async disconnect(): Promise<void> {
        // No-op
    }
}
