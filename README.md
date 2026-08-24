# AI Visualizer

> Watch a real language model choose every word it writes, inside a map of everything it knows.
> Pause, rotate, and rewind any decision.

A website that makes a language model's word-by-word thinking visible. A real open-weight model
(`Qwen/Qwen2.5-0.5B-Instruct`) runs a genuine forward pass for every word it writes. Each step
renders two ways at once: lit inside a rotatable 3D map of all **151,665 tokens the model knows**,
positioned by a UMAP projection of its own embeddings — and a panel beside it showing the actual
numbers, the two linked so highlighting one highlights the other. Click any token, including ones
the model never considered, and it names itself. The whole run is recorded as it happens, so it can
be played, paused, sped up, slowed down, and scrubbed backwards.

**Nothing on screen is faked.** Every probability, attention weight and coordinate comes from a
real forward pass, and the legend states the limits as plainly as the features.

## Status

**Works end to end.** Type a prompt, the model runs, and you watch it choose each word in 3D — the
candidates it weighed, the earlier tokens it attended to, and the exact numbers behind both.
Playback is pausable, scrubbable and speed-controlled.

The backend runs on Modal. Measured against the deployment: **15 s** cold container boot, **~1.2 s**
to load the weights (they ship inside the image rather than being downloaded), and ~690 MB peak
memory after a 115-token run — comfortably inside a 1 GB container.

### Scope, stated plainly

This visualizes **generation**. An earlier plan committed to a second phase — document retrieval
feeding the same engine — and it was cut once generation worked end to end, on the grounds that a
finished thing beats a broader half-built one. There is no retrieval code, no vector store, and no
retrieval fields in the event schema; the schema is complete rather than partial.

## Running it locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

The first model load downloads ~1 GB into `~/.cache/huggingface/hub`, once. Everything runs on CPU.

**Watch a full generation in the terminal** — every step's candidates, probabilities, and attention.
This is the model-side debugger; check backend changes here before checking them in a browser.

```bash
./.venv/bin/python backend/scripts/run_local.py "What is the capital of France?"
```

**Run the server:**

```bash
cd backend && ../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

`GET /health` reports whether the model is loaded. `WS /ws` takes
`{"prompt": "...", "max_tokens": 60}` and streams `step` events followed by `done`.

**Other tools:** `chat.py` (talk to it), `tokens.py` (see tokenization), `probe.py` (one step's
numbers in detail).

## Deploying

The backend is a plain container with no vendor SDK, which is what keeps the hosting choice cheap
and swappable.

```bash
docker build -t aiviz .
docker run --rm -p 8000:8000 -e ALLOWED_ORIGINS=https://your-frontend.example.com aiviz
```

**Measured, so you can size it honestly:** the image is 3.35 GB with the model weights baked in,
peaks at ~690 MB of memory after a 115-token run, and runs inside a **1 GB** container. Weight
load is ~1.2 s because nothing is downloaded at boot. Generation is roughly 7 tok/s in a
container versus 32 natively.

### Deploying the backend to Modal

Modal was chosen for measured reasons: $30/month of free credits against a run cost of roughly
**$0.00005**, per-second billing, scale-to-zero, and confirmed WebSocket support. The trade is a
cold start when nothing has run recently, which the frontend handles by retrying and saying so.

```bash
pip install modal
modal token new                        # one-time browser login
modal deploy deploy/modal_app.py
```

It builds the same Dockerfile used above and prints a public URL. Nothing in the service is
Modal-specific — [`deploy/modal_app.py`](deploy/modal_app.py) is the only file that mentions it, so
switching hosts means deleting that file, not rewriting anything.

Then point the frontend at it and set the backend's allowed origin:

```bash
cd frontend && VITE_API_URL=https://<your-modal-url> npm run build
```

### Deploying the frontend to Vercel

```bash
npm i -g vercel
cd frontend
vercel login
vercel link                    # create or attach the project
vercel env add VITE_API_URL production      # paste the Modal URL when prompted
vercel --prod
```

**`VITE_API_URL` must be set before the build, not after.** Vite substitutes it at build time, so
a value added later has no effect until the next deploy — and the symptom is a live site that
insists the model is offline while pointing at `localhost:8000`.

[`vercel.json`](frontend/vercel.json) sets the caching policy. Hashed assets are immutable; the
vocabulary artifacts get a week, because Vite copies `public/` through without fingerprinting and
`immutable` would strand a stale map in every cache the day they are regenerated.

Afterwards, put the Vercel URL into `FRONTEND_ORIGIN` in
[`deploy/modal_app.py`](deploy/modal_app.py) and run `modal deploy` again, or the deployed page
cannot read `/health`.

### Deploying the frontend anywhere else

Set `VITE_API_URL` to the backend's public URL — the WebSocket URL
is derived from it, so an `https://` value becomes `wss://` automatically, which matters because a
deployed HTTPS page cannot open a plain `ws://` socket.

```bash
cd frontend && VITE_API_URL=https://your-backend.example.com npm run build
```

Both `.env.example` files list what each side needs.

### What the deployed service does and doesn't do
- **No database, no user data, nothing written at runtime.** All storage is static files in this
  repo plus the weights in the image.
- **Rate limited**: one generation at a time, at most three queued, and a per-connection cooldown —
  because a public endpoint that runs a model for anyone is otherwise trivially abusable.
- **Scale-to-zero friendly**: the frontend retries the socket with backoff and explains the wait,
  so a sleeping container is a delay rather than a broken page.
