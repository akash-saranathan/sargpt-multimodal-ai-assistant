FROM python:3.11

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng poppler-utils libmagic1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY download_models.py .
RUN python download_models.py

COPY agent/ ./agent/
COPY api/ ./api/
COPY config/ ./config/
COPY guardrails/ ./guardrails/
COPY ml/ ./ml/
COPY nemo_guard.py .
COPY frontend/dist/ ./frontend/dist/

RUN mkdir -p temp data kb kb_faiss

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]