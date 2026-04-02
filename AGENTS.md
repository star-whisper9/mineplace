# Project Context & Rules

## Tech Stack

- **Runtime**: Node.js 24 LTS
- **Language**: TypeScript (Strict Mode)
- **Module System**: ESM (`type: module`)
- **Linting**: ESLint (Flat Config)
- **Formatting**: Prettier

## Coding Standards

1.  **Type Safety**: Avoid `any`. Use `unknown` if necessary and narrow types.
2.  **Async/Await**: Prefer `async/await` over raw Promises.
3.  **Functional Style**: Prefer pure functions and immutability where possible.
4.  **Imports**: Use explicit extensions for local imports if required by configuration (though `tsx` handles it, standard ESM requires `.js` in imports usually, but with bundlers/tsx it's flexible. Stick to standard ESM practices).
5.  **Error Handling**: Use structured error handling.

## Workflow

- Run `npm run dev` for development (uses `tsx watch`).
- Run `npm run lint` to check code quality.
- Run `npm run format` to fix formatting.
