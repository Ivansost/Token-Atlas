# The backend, as a plain container. No platform SDK, nothing vendor-specific -- that is what
# keeps the M8 hosting choice cheap and late.
#
#   docker build -t aiviz .
#   docker run --rm -p 8000:8000 aiviz
#
# Memory: measured at ~690 MB peak after a 115-token run with a long prompt, comfortably inside a
# 1 GB limit (see MODEL_NOTES.md). 1 GB works, 2 GB has headroom, 512 MB does not -- and it would
# fail on the first prompt rather than at startup, which is a nastier failure than it sounds.

FROM python:3.13-slim

# Weights live here rather than in a home directory that may not survive between layers or users.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/opt/huggingface

WORKDIR /app

# CPU-ONLY TORCH, INSTALLED FIRST AND DELIBERATELY.
#
# The default torch wheel on PyPI for Linux bundles the CUDA runtime -- several gigabytes of GPU
# libraries this project will never load, on a container that has no GPU. Installing from PyTorch's
# CPU index first means the pinned requirements below find torch already satisfied and leave it
# alone.
RUN pip install --no-cache-dir torch==2.13.0 --index-url https://download.pytorch.org/whl/cpu

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# BAKE THE WEIGHTS IN.
#
# Without this the container downloads 953 MB from HuggingFace on every cold start. Since the whole
# hosting plan is scale-to-zero, cold starts are the normal case rather than the exception, so the
# download belongs in the image, paid once at build time. With the weights baked in, loading them
# takes ~1.2 s -- the M0 figure of 27 s was the download, not the load.
RUN python -c "from app.model import get_model; get_model()" \
 && python -c "from app.projection import is_available; assert is_available(), 'projection artifact missing'"

EXPOSE 8000

# $PORT because most hosts inject one; 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
