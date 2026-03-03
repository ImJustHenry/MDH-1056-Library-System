FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer-cached unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

EXPOSE 5000

# 2 workers is plenty for a free Render instance; tweak up if you upgrade
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "run:app"]
