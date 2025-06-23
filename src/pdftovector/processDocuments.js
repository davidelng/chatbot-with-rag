import { basename } from 'path';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

export async function processPDFForIndex(objectKey, pdf, vectorStore) {
    try {
        console.log(`Starting PDF processing for: ${objectKey}`);
        const startTime = Date.now();

        const buffer = Buffer.isBuffer(pdf) ? pdf : Buffer.concat(pdf);
        const loader = new PDFLoader(new Blob([buffer], { type: 'application/pdf' }));
        const docs = await loader.load();
        console.log(`Loaded ${objectKey} - ${docs.length} pages`);

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 800,
            chunkOverlap: 100,
            separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' '],
            keepSeparator: false,
            lengthFunction: (text) => text.length,
        });

        const splitDocs = await splitter.splitDocuments(docs);
        console.log(`Split into ${splitDocs.length} chunks`);

        const filename = basename(objectKey);
        const title = filename.trim().replace('.pdf', '');

        const processedDocs = await preprocessDocuments(splitDocs, filename, title);

        console.log(
            `Processed documents: ${processedDocs.length} (filtered from ${splitDocs.length})`
        );

        await indexDocumentsInBatches(processedDocs, vectorStore);

        const endTime = Date.now();
        console.log(`PDF processing completed in ${endTime - startTime}ms`);

        return {
            success: true,
            filename,
            title,
            originalChunks: splitDocs.length,
            processedChunks: processedDocs.length,
            processingTime: endTime - startTime,
        };
    } catch (error) {
        console.error(`Error processing PDF ${objectKey}:`, error);
        throw error;
    }
}

function removeDuplicateChunks(docs) {
    const seen = new Set();
    const unique = [];

    for (const doc of docs) {
        const hash = doc.metadata.contentHash;
        if (!seen.has(hash)) {
            seen.add(hash);
            unique.push(doc);
        }
    }

    console.log(`Removed ${docs.length - unique.length} duplicate chunks`);
    return unique;
}

// create a simple deterministic checksum
function hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i); // get char code
        hash = (hash << 5) - hash + char; // shift by 5 bits and subtract current hash is similar to a classic multiply by 31, then add char code
        hash = hash & hash; // bit mask to ensure the 32 bit range
    }
    return hash.toString();
}

function isValidChunk(content) {
    if (!content || content.length < 100) return false; // Too short

    // Calculate density of alphanumeric chars
    const alphanumeric = (content.match(/[a-zA-Z0-9]/g) || []).length;
    const density = alphanumeric / content.length;

    if (density < 0.7) return false; // Too many special chars

    // Verify that chunk is not only numbers and special chars
    const uniqueChars = new Set(content.toLowerCase()).size;
    if (uniqueChars < 10) return false; // Too repetitive

    return true;
}

function cleanTextContent(content) {
    if (!content || typeof content !== 'string') return '';

    return (
        content
            // Remove control chars
            .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
            // Remove multiple spaces
            .replace(/\s+/g, ' ')
            // Remove parts with numbers only
            .replace(/^\s*\d+\s*$/gm, '')
            // Normalize punctuation
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'")
            // Final trim
            .trim()
    );
}

async function preprocessDocuments(splitDocs, filename, title) {
    const processedDocs = [];

    for (let i = 0; i < splitDocs.length; i++) {
        const doc = splitDocs[i];

        const cleanedContent = cleanTextContent(doc.pageContent);

        if (!isValidChunk(cleanedContent)) {
            console.log(`Skipped chunk ${i + 1}: too short or low quality`);
            continue;
        }

        doc.pageContent = cleanedContent;
        doc.metadata.filename = filename;
        doc.metadata.title = title;
        doc.metadata.contentHash = hashContent(cleanedContent);
        doc.metadata.indexedAt = new Date().toISOString();

        processedDocs.push(doc);
    }

    const deduplicatedDocs = removeDuplicateChunks(processedDocs);

    return deduplicatedDocs;
}

async function validateBatchBeforeIndexing(batch) {
    for (let i = 0; i < batch.length; i++) {
        const doc = batch[i];

        if (!doc.pageContent || doc.pageContent.length < 50) {
            throw new Error(`Invalid document at index ${i}: content too short`);
        }

        if (!doc.metadata || !doc.metadata.filename) {
            throw new Error(`Invalid document at index ${i}: missing metadata`);
        }
    }
}

async function indexDocumentsInBatches(docs, vectorStore) {
    const batchSize = 25;
    const maxRetries = 3;

    console.log(`Starting batch indexing: ${docs.length} documents in batches of ${batchSize}`);

    for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(docs.length / batchSize);

        console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} docs)`);

        let retryCount = 0;
        let success = false;

        while (!success && retryCount < maxRetries) {
            try {
                const startTime = Date.now();

                await validateBatchBeforeIndexing(batch);

                await vectorStore.addDocuments(batch);

                const endTime = Date.now();
                console.log(
                    `Batch ${batchNumber} indexed successfully in ${endTime - startTime}ms`
                );
                success = true;

                await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
                retryCount++;
                console.error(`Batch ${batchNumber} attempt ${retryCount} failed:`, error.message);
            }
        }
    }
}
