export interface VectorRecord {
    id: string;
    vector: number[];
    payload: Record<string, any>;
}

export abstract class VectorDBConnector {
    protected connectionString: string = "";
    protected apiKey?: string;

    constructor() {}

    /**
     * Establish connection to the vector database.
     */
    abstract connect(connectionString: string, apiKey?: string): Promise<void>;

    /**
     * List all collection/index names inside the database.
     */
    abstract getCollections(): Promise<string[]>;

    /**
     * Reads a batch of vectors from a collection.
     */
    abstract readVectors(
        collectionName: string,
        limit: number,
        offset: number
    ): Promise<VectorRecord[]>;

    /**
     * Writes/upserts a batch of vectors to a collection.
     */
    abstract upsertVectors(
        collectionName: string,
        vectors: VectorRecord[]
    ): Promise<void>;

    /**
     * Closes any active network connections.
     */
    abstract disconnect(): Promise<void>;
}
