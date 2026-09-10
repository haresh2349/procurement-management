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
| `MONGODB_URI`     | —             | MongoDB connection string (required)                 |
| `JWT_SECRET`      | —             | Secret for signing JWT access tokens (required)    |
| `JWT_EXPIRES_IN`  | `7d`          | JWT expiry duration                                |
| `ADMIN_EMAIL`     | —             | Seed script: first admin email                       |
| `ADMIN_PASSWORD`  | —             | Seed script: first admin password                    |
| `UPLOAD_DIR`      | `uploads`     | Local directory for uploaded checklist files       |
| `MAX_UPLOAD_SIZE_MB` | `5`        | Maximum upload size per file in megabytes          |




## API

- `GET /api/v1/health` — Health check
- `POST /api/v1/auth/login` — Login with email or mobile + password
- `POST /api/v1/users` — Admin creates Procurement Manager, Inspection Manager, or Client
- `POST /api/v1/users` — Procurement Manager creates Inspection Manager or Client (Inspection Manager is auto-assigned to the caller)
- `GET /api/v1/users` — Admin lists all PMs/IMs/Clients; Procurement Manager lists only owned clients and assigned IMs. Supports `?role=CLIENT|INSPECTION_MANAGER|PROCUREMENT_MANAGER&page=1&limit=20`
- `GET /api/v1/users/:id` — Get user by id with ownership filtering
- `PATCH /api/v1/users/:inspectionManagerId/assign` — Admin assigns Inspection Manager to Procurement Manager
- `PATCH /api/v1/users/:inspectionManagerId/unassign` — Admin unassigns Inspection Manager
- `POST /api/v1/checklist-templates` — Admin/PM creates a reusable checklist template for a client
- `GET /api/v1/checklist-templates` — List checklist templates. Supports `?clientId=&page=1&limit=20`
- `GET /api/v1/checklist-templates/:id` — Get checklist template by id
- `PATCH /api/v1/checklist-templates/:id` — Update checklist template (question changes bump `version`)
- `POST /api/v1/orders` — Procurement Manager creates an order for an owned client (optional `inspectionManagerId`). Auto-generates human-readable `orderId` (e.g. `ORD-0001`)
- `GET /api/v1/orders` — List orders visible to the authenticated user. Supports `?status=&clientId=&inspectionManagerId=&page=1&limit=20`
- `GET /api/v1/orders/:orderId` — Get order by business `orderId` (e.g. `ORD-0001`) with ownership filtering
- `PATCH /api/v1/orders/:orderId/inspection-manager` — Assign or change Inspection Manager while order is `CREATED`
- `POST /api/v1/orders/:orderId/checklist` — Attach a `ChecklistTemplate` snapshot to an order while it is `CREATED`
- `GET /api/v1/orders/:orderId/checklist` — Read attached checklist snapshot and saved answers
- `PATCH /api/v1/orders/:orderId/checklist/answers` — Assigned Inspection Manager saves checklist answers while inspection is in progress
- `POST /api/v1/orders/:orderId/checklist/questions/:questionId/file` — Upload a file for a `FILE` question (multipart field name: `file`)
- `POST /api/v1/orders/:orderId/checklist/submit` — Assigned Inspection Manager submits completed inspection (`INSPECTION_COMPLETED`)
- `GET /api/v1/files/:fileId` — Download an uploaded checklist file (authorized viewers only)
- `PATCH /api/v1/orders/:orderId/status` — Perform allowed order status transitions

### Bootstrap admin

```bash
npm run seed:admin
```

Requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`.

### End-to-end API flow script

Runs the full procurement lifecycle and key negative scenarios against your configured MongoDB:

```bash
npm run seed:admin
npm run e2e:flow
```

The script uses in-process HTTP calls (no separate server required), creates isolated users per run, and prints `[PASS]` / `[FAIL]` for each scenario.



## Architecture

- ESM (`"type": "module"`)
- Feature-based modules under `src/modules/` (to be added incrementally)
- Centralized error handling and consistent API response format

