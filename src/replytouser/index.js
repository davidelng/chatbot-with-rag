import { ChatPromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { RedisChatMessageHistory } from '@langchain/redis';
import { ChatError, RequestError } from './errors.js';
import { isContentSafe, isQueryMeaningful } from './moderation.js';
import { initializeModel, initializeRedis, initializeVectorStore } from './resources.js';

const generateReply = async (event) => {
    let redis = null;

    try {
        /**
         * VALIDAZIONI
         */

        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        if (!body) {
            throw new RequestError('Body is empty', 400);
        }

        if (!body?.consentAccepted) {
            throw new RequestError('Use policy rejected by user', 400);
        }

        const userId = body?.userId;
        if (!userId) {
            throw new RequestError('No userId sent', 400);
        }

        const sessionId = body?.sessionId;
        if (!sessionId) {
            throw new RequestError('No sessionId sent', 400);
        }

        const fullQuestion = body?.query;
        if (!fullQuestion) {
            throw new ChatError('No query sent', 400);
        }

        const question = fullQuestion.substring(0, 300); // trim for safety

        if (!isQueryMeaningful(question)) {
            throw new ChatError('Please provide a more specific question', 400);
        }

        const isSafe = await isContentSafe(question);
        if (!isSafe) {
            throw new Error('Content moderation failed: inappropriate content detected');
        }

        const redisSessionID = `${userId}_${sessionId}`;

        /**
         * INIZIALIZZAZIONE
         */

        const [model, vectorStore] = await Promise.all([
            initializeModel(),
            initializeVectorStore(),
        ]);

        redis = await initializeRedis();

        const chatHistory = new RedisChatMessageHistory({
            sessionId: redisSessionID,
            sessionTTL: 7200,
            client: redis,
        });

        let msg = await chatHistory.getMessages();
        msg = msg.slice(0, 6);

        /**
         * PROMPT TEMPLATE
         */

        console.time('context-prompt');
        const contextualizePrompt = `Given the chat history and the user's last question, which may refer to the context in the chat history, ask a question of its own, which can be understood without the chat history. DO NOT answer the question, only rephrase it if necessary, and otherwise return it as is.

        Chat: {chat_history}

        Input: {input}`;

        const contextPrompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(contextualizePrompt),
        ]);

        const contextPromptText = await contextPrompt.invoke({
            chat_history: msg,
            input: question,
        });
        let contextualizedQuestion = await model.invoke(contextPromptText);
        contextualizedQuestion = contextualizedQuestion.content;
        // console.log(contextualizedQuestion);
        console.timeEnd('context-prompt');

        console.time('similarity-search');
        const documents = await vectorStore.similaritySearch(contextualizedQuestion, 3);
        let documentsText = '';
        for (let doc of documents) {
            documentsText += doc.metadata.title + '\n' + doc.pageContent + '\n\n';
        }
        console.timeEnd('similarity-search');

        console.time('final-prompt');

        const promptTemplate = `You are an assistant who answers questions.
        Answer in english concisely using only the information contained in the context provided and the history of the conversation.
        If the context does not contain enough information to construct a short answer, do not invent anything and reply that it is not possible to provide an answer.

        Context: {context}

        Input: {input}
        `;

        const documentPrompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(promptTemplate),
        ]);

        const documentPromptText = await documentPrompt.invoke({
            context: documentsText,
            input: contextualizedQuestion,
        });

        /**
         * CHAINS
         */

        const response = await model.invoke(documentPromptText);
        console.timeEnd('final-prompt');

        if (!response || typeof response.content !== 'string') {
            throw new Error('Invalid response format from RAG chain');
        }

        console.log(response.content);

        await chatHistory.addUserMessage(contextualizedQuestion);
        await chatHistory.addAIMessage(response.content);
    } catch (err) {
        console.error(err);
    } finally {
        if (redis) {
            try {
                await redis.quit();
                console.log('Redis connection closed');
            } catch (cleanupError) {
                console.error('Error closing Redis connection:', cleanupError);
            }
        }
    }
};

export default generateReply;
