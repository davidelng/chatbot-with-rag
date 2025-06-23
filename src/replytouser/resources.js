import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { createClient as createRedisClient } from 'redis';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import { OpenSearchVectorStore } from '@langchain/community/vectorstores/opensearch';

export async function initializeModel() {
    return new ChatOpenAI({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        apiKey: process.env.OPENAI_API_KEY,
        temperature: 0,
        maxTokens: 800,
        timeout: 60000,
        maxRetries: 2,
    });
}

export async function initializeRedis() {
    const redis = createRedisClient({
        url: `redis://${process.env.REDIS_ENDPOINT}:6379`,
        socket: {
            connectTimeout: 5000,
            lazyConnect: true,
        },
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
    });
    await redis.connect();
    await redis.ping();
    return redis;
}

export async function initializeVectorStore() {
    const embeddings = new OpenAIEmbeddings({
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        timeout: 10000,
        maxRetries: 1,
        stripNewLines: true,
        maxConcurrency: 3,
    });

    return new OpenSearchVectorStore(embeddings, {
        client: new OpenSearchClient({
            nodes: [process.env.OPENSEARCH_DOMAIN],
            ssl: { rejectUnauthorized: false },
            requestTimeout: 10000,
            pingTimeout: 5000,
            maxRetries: 1,
            compression: 'gzip',
            pool: { maxSockets: 5 },
        }),
        indexName: process.env.OPENSEARCH_INDEX,
    });
}
