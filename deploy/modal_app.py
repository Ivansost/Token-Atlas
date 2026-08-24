"""Deploy the backend to Modal.

    pip install modal
    modal token new          # one-time, opens a browser to authenticate
    modal deploy deploy/modal_app.py

Modal prints a URL. Put it in the frontend's VITE_API_URL and rebuild the frontend.

WHY MODAL: per-second billing with $30/month of free credits, and it scales to zero. A run costs
roughly $0.00005 in CPU and memory, so portfolio traffic stays inside the credits by orders of
magnitude. The trade is a cold start when nothing has run recently -- which the frontend already
handles by retrying the socket and saying plainly that it is waking the server.

NOTHING HERE IS MODAL-SPECIFIC EXCEPT THIS FILE. The image is built from the same Dockerfile that
runs locally, and the app it serves is the same FastAPI object. Moving to another host means
deleting this file, not rewriting the service.
"""

import sys

import modal

# EDIT THIS after deploying the frontend, then redeploy.
#
# The browser fetches /health from the deployed page's origin, and FastAPI's CORS middleware
# blocks it unless that origin is allowed. WebSockets are not subject to CORS, so the symptom is
# specific and confusing: generation works, but the interface cannot tell whether the model is
# loaded. Localhost is always permitted, so development needs nothing here.
FRONTEND_ORIGIN = ""   # e.g. "https://ai-visualizer.vercel.app"

# The same Dockerfile that `docker build -t aiviz .` uses. Modal builds it for linux/amd64 and
# ignores EXPOSE/CMD, running its own server against the ASGI app below.
image = modal.Image.from_dockerfile("Dockerfile").env({"ALLOWED_ORIGINS": FRONTEND_ORIGIN})

app = modal.App("ai-visualizer", image=image)


@app.function(
    # Measured, not guessed: ~690 MB peak after a 115-token run with a long prompt, so 1 GB has
    # real headroom, measured in-container after a long run.
    memory=1024,
    cpu=2.0,
    # Keep a container alive this long after the last request. Longer means fewer cold starts for
    # the next visitor; it also means more billed time. Five minutes is a compromise worth tuning
    # once there is real traffic to look at.
    scaledown_window=300,
    # A hard ceiling on how much this can ever cost, since the endpoint is public and unauthenticated.
    max_containers=2,
)
# One container can hold several WebSocket connections. Each connection is one Modal input, so
# without this a second visitor would wait for the first to disconnect rather than share the
# container. The app's own semaphore still serialises generation inside the process.
@modal.concurrent(max_inputs=8)
@modal.asgi_app()
def web():
    # The Dockerfile copies backend/ to /app; Modal does not necessarily run with that on the path.
    sys.path.insert(0, "/app")
    from app.main import app as fastapi_app

    return fastapi_app
