import path from 'path';
import fs from 'fs';
import { Client as OpensearchClient } from '@opensearch-project/opensearch';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OpenSearchVectorStore } from '@langchain/community/vectorstores/opensearch';
import { processPDFForIndex } from './processDocuments.js';

const loadDocuments = async (event) => {
    try {
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: process.env.OPENAI_EMBEDDING_MODEL,
        });

        const osClient = new OpensearchClient({
            node: process.env.OPENSEARCH_DOMAIN,
            ssl: { rejectUnauthorized: false },
        });

        const vectorStore = new OpenSearchVectorStore(embeddings, {
            client: osClient,
            indexName: process.env.OPENSEARCH_INDEX,
        });

        if (event?.deleteIndex) {
            try {
                await osClient.indices.delete({ index: process.env.OPENSEARCH_INDEX });
            } catch (err) {
                console.error('index delete error:', err);
            }
        }

        // https://js.langchain.com/docs/integrations/document_loaders/file_loaders/pdf
        const volumePath = process.cwd() + '/data';
        console.log('Reading files');
        const pdfToIndex = fs.readdirSync(volumePath);
        for (const pdf of pdfToIndex) {
            if (!pdf.toLowerCase().endsWith('.pdf')) {
                continue;
            }
            console.log(`Indexing ${pdf}`);
            const pdfBuffer = fs.readFileSync(path.join(volumePath, pdf));
            await processPDFForIndex(pdf, pdfBuffer, vectorStore);
        }

        console.log('PDF loaded into OpenSearch');
    } catch (err) {
        console.log(err);
    }
};

export default loadDocuments;
