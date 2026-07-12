import axios from "axios";
import { VectorRecord } from "./connectors/base";

export class EmbeddingTransformer {
    /**
     * Re-embeds the text field from the record payload using OpenAI API.
     */
    public async reEmbedRecord(
        record: VectorRecord,
        apiKey: string,
        model: string,
        textField: string
    ): Promise<VectorRecord> {
        const text = record.payload[textField];
        
        if (!text || typeof text !== "string") {
            throw new Error(`Text field "${textField}" not found or is not a string in vector payload (ID: ${record.id})`);
        }

        try {
            const response = await axios.post(
                "https://api.openai.com/v1/embeddings",
                {
                    input: text,
                    model: model
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`
                    },
                    timeout: 8000
                }
            );

            const embedding = response.data?.data?.[0]?.embedding;
            if (!embedding || !Array.isArray(embedding)) {
                throw new Error("Invalid response format from OpenAI embeddings API");
            }

            return {
                id: record.id,
                vector: embedding,
                payload: record.payload
            };

        } catch (err: any) {
            const errMsg = err.response?.data?.error?.message || err.message;
            throw new Error(`OpenAI Embedding failure (ID: ${record.id}): ${errMsg}`);
        }
    }
}
