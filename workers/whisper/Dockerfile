FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
ENV WHISPER_MODEL=base WHISPER_DEVICE=cpu WHISPER_COMPUTE=int8
EXPOSE 8088
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8088"]
