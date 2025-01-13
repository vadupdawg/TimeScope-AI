# Gebruik een officiële Python-runtime als basisimage
FROM python:3.11.4-slim

# Zet omgevingsvariabelen
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Stel de werkmap in de container in
WORKDIR /app

# Installeer git en andere benodigdheden
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip
RUN pip install gunicorn

# Kopieer alleen requirements.txt eerst om de Docker cache beter te benutten
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Kopieer alleen de benodigde bestanden
COPY main.py /app/
COPY static /app/static/

# Start de applicatie met worker en thread configuratie
CMD ["gunicorn", "-b", "0.0.0.0:8080", "--timeout", "60", "main:app"]