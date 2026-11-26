<<<<<<< HEAD
# InfraScan Backend

Two layers:

- `ai/`  : AI engine (no FastAPI, no database). Test it alone.
- `app/` : Platform (FastAPI, database, login, assets, inspections, reports).

Rule: `ai/` never imports from `app/`. `app/` calls `ai.pipeline.analyze()`.

## Phases
1. AI engine (ai/)
2. Platform base (login, assets, inspections, upload)
3. Connect AI to platform (analysis, results saved, engineer review)
4. Reports and analytics
5. Testing, Docker, documentation

## Setup
```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
Copy `.env.example` to `.env`. Put model files in `ai/weights/` (see README there).
=======
# infrascan-backend-demo
>>>>>>> 81f6d3be17c354a9dc9b1e1b3ac07efa82769c15
