export function isQueryMeaningful(question) {
    const minLength = 3;
    const cleanedQuestion = question.trim().toLowerCase();
    return cleanedQuestion.split(' ').length >= minLength;
}

export async function isContentSafe(inputText) {
    try {
        const response = await fetch('https://api.openai.com/v1/moderations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({ input: inputText }),
        });
        const moderationResult = await response.json();
        return !moderationResult.results[0].flagged;
    } catch (error) {
        console.error('Moderation check failed:', error);
        return true;
    }
}
