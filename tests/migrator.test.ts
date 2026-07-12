import test from "node:test";
import assert from "node:assert";
import { MemoryConnector } from "../src/connectors/memory";
import { MigrationOrchestrator } from "../src/migrator";

test("MigrationOrchestrator - stream memory-to-memory vectors", async () => {
    // 1. Setup seeded source memory DB
    const source = new MemoryConnector();
    await source.connect("seed-collection");

    // 2. Setup empty target memory DB
    const target = new MemoryConnector();
    await target.connect("empty");

    const orchestrator = new MigrationOrchestrator();

    // Verify initial state
    assert.deepStrictEqual(await source.getCollections(), ["default-collection"]);
    assert.deepStrictEqual(await target.getCollections(), []);

    // 3. Execute migration with concurrency = 4 and custom JS transformer script
    const result = await orchestrator.migrate({
        sourceConnector: source,
        targetConnector: target,
        collectionName: "default-collection",
        targetCollectionName: "migrated-collection",
        batchSize: 10,
        concurrency: 4,
        transformScript: `
            payload.migrated_at = 123456789;
            payload.upper_case_text = payload.text.toUpperCase();
            delete payload.category;
        `
    });

    // 4. Assertions
    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.completed, 50);
    assert.ok(result.rate > 0);
    assert.ok(result.elapsedSeconds > 0);

    // Verify target database contains the 50 migrated vectors
    assert.deepStrictEqual(await target.getCollections(), ["migrated-collection"]);
    assert.strictEqual(target.getCollectionCount("migrated-collection"), 50);

    // Verify metadata payload and transformations
    const migratedBatch = await target.readVectors("migrated-collection", 5, 0);
    assert.strictEqual(migratedBatch.length, 5);
    
    // Check that JS mappings ran correctly
    assert.strictEqual(migratedBatch[0].payload.migrated_at, 123456789);
    assert.strictEqual(migratedBatch[0].payload.category, undefined); // deleted
    assert.ok(migratedBatch[0].payload.upper_case_text.startsWith("THIS IS TEXT DOCUMENT"));
    
    // Check vector length
    assert.strictEqual(migratedBatch[0].vector.length, 128); // 128 dimensions
});
