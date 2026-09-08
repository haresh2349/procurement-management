# Procurement Management API

Backend API for procurement and inspection management.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
cp .env
```

## Scripts


| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `npm run dev`    | Start development server with hot reload |
| `npm run build`  | Compile TypeScript to `dist/`            |
| `npm start`      | Run compiled production build            |
| `npm test`       | Run tests                                |
| `npm run lint`   | Lint source files                        |
| `npm run format` | Format source files with Prettier        |


## Environment Variables


| Variable    | Default       | Description                                          |
| ----------- | ------------- | ---------------------------------------------------- |
| `NODE_ENV`    | `development` | Runtime environment                                  |
| `PORT`        | `3000`        | HTTP server port                                     |
| `LOG_LEVEL`   | `info`        | Minimum log level (`debug`, `info`, `warn`, `error`) |
| `MONGODB_URI` | —             | MongoDB connection string (required)                 |




## API

- `GET /api/v1/health` — Health check



## Architecture

- ESM (`"type": "module"`)
- Feature-based modules under `src/modules/` (to be added incrementally)
- Centralized error handling and consistent API response format

