# InfraScan Frontend (JavaScript)

React + Vite frontend converted to JavaScript/JSX and configured for the InfraScan FastAPI backend.

## Requirements
- Node.js 20.14.0 or later in the Node 20 line (Vite 6 is used to avoid Vite 8’s newer Node requirement)
- Python backend running at `http://127.0.0.1:8000`

## Run
```bash
npm install
npm run dev
```

The frontend API base URL is configured in `.env` as `http://127.0.0.1:8000/api`. Restart Vite after changing `.env`.

## Backend integration notes
- Login uses JSON `{ "email", "password" }` at `/api/auth/login`.
- Registration uses `/api/auth/register`; the backend assigns new accounts the `inspector` role (the frontend reflects that role).
- Assets use `/api/assets` and the backend `{ total, items }` response.
- Inspections use `/api/inspections`; image upload creates an inspection, uploads to `/images`, then requests `/analyze`.
- Asset create/edit controls are shown only for civil engineers, managers, and administrators, matching backend permissions.
- The backend does not currently expose `/dashboard/summary`, `/maintenance/{id}`, or `/inspections/{id}/report`; dashboard totals are derived from available asset/inspection data, and maintenance prioritization remains local UI state until corresponding backend endpoints exist.

Do not commit production secrets or a backend `.env` file.
