FROM python:3.11-slim

WORKDIR /app

# OpenCV aur PostgreSQL ke system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Hugging Face non-root user (uid 1000) ke liye storage aur model weights folders writable banayein
RUN mkdir -p /app/storage /app/ai/weights && chmod -R 777 /app/storage /app/ai/weights /app

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]