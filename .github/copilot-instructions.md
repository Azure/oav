# Copilot Instructions for oav

## Project Overview

oav (openapi-validation-tools) is an npm package for validating Azure REST API specifications (OpenAPI/Swagger). It provides semantic validation, model validation, live traffic validation, example quality checks, and traffic conversion utilities.

## Build, Lint, and Test

- **Install dependencies**: `npm ci`
- **Build**: `npm run build` (runs TypeScript compiler, linting, and template copying in parallel)
- **Lint**: `npm run lint`
- **Lint with auto-fix**: `npm run lint-fix`
- **Run all tests**: `npm test` (builds first, then runs Jest)
- **Run tests only (skip build)**: `npm run fast-test`
- **Run a specific test file**: `npx jest <test-file-name>`

## Language and Framework

- **TypeScript** with strict mode, targeting ES2018, using CommonJS modules
- **Node.js** >= 20
- **Dependency injection** via inversify with decorators (`experimentalDecorators` and `emitDecoratorMetadata` enabled)

## Coding Conventions

- **Formatter**: Prettier with semicolons and 100-character print width
- **Linting**: ESLint with `@typescript-eslint/parser`, Prettier integration, and enforced import ordering (`import/order`)
- **Array types**: Use simple array syntax (`string[]`) instead of generic (`Array<string>`)
- **Imports**: Keep imports ordered (enforced by ESLint `import/order` rule)
- **Module system**: CommonJS (`require`/`module.exports` in JS, standard `import`/`export` in TS compiled to CommonJS)

## Testing

- **Framework**: Jest with ts-jest for TypeScript support
- **Test location**: `test/` directory, with test files named `*Tests.ts` or `*Test.ts`
- **Test match pattern**: `**/test/**/*.ts`
- **Run tests**: `npm test` or `npm run fast-test` for quicker iteration
- Tests should validate both success cases and error/edge cases

## Project Structure

- `lib/` — Main source code (validators, models, CLI commands, utilities)
- `test/` — Test files and test fixtures
- `dist/` — Compiled output (do not edit directly)
- `documentation/` — Additional documentation
- `regression/` — Regression test configurations
- `eng/` — Engineering and build scripts
