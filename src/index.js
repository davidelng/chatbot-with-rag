import loadDocuments from './pdftovector/index.js';
import generateReply from './replytouser/index.js';

if (process.env.LOAD_DOCUMENTS) {
    console.time('loaddocuments');
    await loadDocuments({ deleteIndex: process.env.DELETE_INDEX });
    console.timeEnd('loaddocuments');
}

console.time('generatereply');
await generateReply({
    body: {
        consentAccepted: true,
        consentTimestamp: '2025-02-26T08:23:52.143Z',
        userId: 'local',
        sessionId: 'test',
        query: process.env.QUERY || 'Tell me about something in your context',
    },
});
console.timeEnd('generatereply');
