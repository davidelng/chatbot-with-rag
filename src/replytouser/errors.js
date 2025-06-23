export class AuthError extends Error {
    constructor(message, statusCode = 401) {
        super(message);
        this.name = 'AUTHORIZATION_ERROR';
        this.statusCode = statusCode;
    }
}

export class ChatError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'CHAT_ERROR';
        this.statusCode = statusCode;
    }
}

export class RequestError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'REQUEST_ERROR';
        this.statusCode = statusCode;
    }
}
