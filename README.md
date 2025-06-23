# Chatbot with RAG

The technologies used are:

- [LangChain](https://js.langchain.com/docs/introduction/)
- [OpenSearch](https://opensearch.org/)
- [Redis](https://redis.io/)

This project consists of two parts:

- a program `/src/pdftovector` that indexes PDF files under `/data` to create context for the chatbot
- a program `/src/replytouser` that takes a question, recontextualizes it based on conversation history saved in Redis, and generates a response from the context

The project is designed to run both autonomously and as a microservice within Lambda or Fargate, so it's already designed to accept input parameters such as consent acceptance, session and user ID.

Console output includes benchmarks to monitor the time the chatbot takes to respond.

## Structure

In the root directory you'll find:

- `.nvmrc` NodeJS version
- `.eslint.config.js` linter configuration
- `.prettierrc` formatter configuration
- `.husky/` contains git hooks
- `docker-compose.yaml` container for local development
- `package.json` dependencies and development scripts
- `src/` all project microservices
- `data/` directory containing PDF files to be indexed

## Essential Steps

1. Run `nvm use` or manually set NodeJS to the version contained in the `.nvmrc` file
2. Install development dependencies in the root and for each service install layer dependencies with `npm install`
3. Populate the .env file
4. Open `src/index.js` and populate the `generateResponse` function event with a question
5. Run everything with `npm run dev`

## Local Services

Redis and OpenSearch are available locally as containers, the docker-compose can be managed with `npm run docker:start` and `npm run docker:stop`.

## Linting and Formatting

[eslint](https://eslint.org/) and [prettier](https://prettier.io/) are used to perform linting and format code in an opinionated manner.

Actions can be executed independently with `npm run lint` and `npm run format` from the root.

Additionally, through Git Hooks and [husky](https://typicode.github.io/husky/), formatting occurs before every commit and linting before every push. During this phase only _staged_ files are considered, through [lint-staged](https://github.com/lint-staged/lint-staged).

## Testing

The included test runner is [vitest](https://vitest.dev/), compatible with Jest.

Tests are run from the root with `npm run test`.
