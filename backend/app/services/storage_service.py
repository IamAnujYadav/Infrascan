"""Where uploaded files live.

Today: a folder on this computer (storage/). Later the same four methods can be
written for a cloud bucket (Cloudflare R2 or AWS S3) without changing the rest of the code.
The database keeps only the KEY of a file (for example inspections/3/ab12.jpg), never the file."""
from pathlib import Path

from app.config import settings


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def local_path(self, key: str) -> Path:
        """Path of the file on disk (the AI models need a real file)."""
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise ValueError("Invalid file key.")
        return path

    def save(self, key: str, data: bytes) -> None:
        path = self.local_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def delete(self, key: str) -> None:
        self.local_path(key).unlink(missing_ok=True)

    def url(self, key: str) -> str:
        """Address the frontend uses to show the file."""
        return "/files/" + key


storage = LocalStorage(Path(settings.storage_dir).resolve())