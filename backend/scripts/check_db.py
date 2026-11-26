"""Check the database connection.  Run from project root:  python -m scripts.check_db"""
from sqlalchemy import text

from app.db.database import engine

print("Connecting to:", engine.url.render_as_string(hide_password=True))
with engine.connect() as connection:
    print("Connected.", connection.execute(text("select version()")).scalar())