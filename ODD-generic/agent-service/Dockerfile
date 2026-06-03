# ODD ADK Agent Service — Python 3.11 (ADK needs >=3.10), Cloud Run ready.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    GOOGLE_GENAI_USE_VERTEXAI=FALSE

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Cloud Run injects $PORT (default 8080).
ENV PORT=8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
