FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-cjk ca-certificates tini && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir aiohttp==3.13.2 playwright==1.56.0 \
 && useradd --create-home --uid 10001 player
WORKDIR /app
COPY screen.py player.html ./
USER player
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["python","screen.py"]
