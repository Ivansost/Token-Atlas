# Token Atlas

> A live 3D view of how a language model chooses its next token.

I built Token Atlas because most language model demos only show the finished answer. I wanted to
see what happened between the prompt and that answer: which tokens had the highest probability,
which one the model selected, and which earlier parts of the context received the most attention.

**Full write-up:** [Coming soon]()

**Live demo:** [Open Token Atlas](https://www.ivansostaric.com/projects/token-atlas/demo)

The app runs `Qwen/Qwen2.5-0.5B-Instruct` and streams every generation step into a map of the
model's full 151,665-token vocabulary. The map comes from a UMAP projection of the model's input
embeddings, so tokens with similar embedding vectors tend to appear near each other.

The demo is designed for a laptop or desktop browser.

## What you can do

- Enter a prompt and watch the answer form one token at a time.
- Inspect the top 200 candidates and their actual probabilities at each step.
- Follow the chosen tokens as they draw a path through the vocabulary.
- See the five previous context positions with the highest last-layer, head-averaged attention.
- Pause, change playback speed, scrub backward, rotate the atlas, and click any vocabulary token.

## How it works

```text
Prompt
  -> FastAPI WebSocket
  -> manual Qwen decoding loop
  -> one JSON event per generated token
  -> React timeline and Three.js scene
```

The backend uses a manual autoregressive decoding loop instead of `model.generate()`. This gives me
access to the logits and attention matrix after every forward pass. The first pass processes the
full prompt; after that, only the newest token is sent back to the model because the KV cache holds
the earlier context. Greedy decoding selects the highest-probability token, which also keeps runs
reproducible.

The vocabulary projection is computed offline and stored as a compact Float32 coordinate file.
In the browser, all 151,665 field points are drawn with one GPU buffer rather than one React object
per token. Candidate nodes, attention links, the generated path, and field points all use the same
coordinate mapping.

FastAPI streams the step events over one WebSocket. The React frontend stores those events
separately from playback, so generation can finish quickly while the viewer pauses or rewinds at
their own pace. The backend is deployed on Modal and the frontend is built with Vite and hosted on
Vercel.

## Reading the visualization

This is not a chain-of-thought viewer. Attention weights show where the model placed attention,
but they do not prove why it chose a token.

The probabilities come directly from the model's next-token distribution. Position comes from a
3D UMAP projection, which is useful for seeing neighbourhoods but cannot preserve every distance
from the original embedding space. The default spread control makes the dense centre easier to
read; setting it to zero restores the raw projected coordinates.

## What I learned

The biggest model-side lesson was understanding the KV cache. Before building this, I mostly used
high-level generation methods. Writing the loop myself forced me to work with logits, attention
tensors, stop tokens, and the difference between the first forward pass and every pass after it.

The main frontend problem was the shape of the data. One component per token would never work for
151,665 points, so I moved the field into typed arrays and one GPU buffer. I also wrote small
shaders for per-point colour and size, then added explicit cleanup when those GPU resources change.

I learned how easy it is to make a visualization look believable while giving it a stronger
meaning than the data supports. That is why the interface keeps full probability precision,
labels attention as attention rather than an explanation, and lets the spread transform return to
the untouched projection.

Putting the model on a public URL added a different set of problems. I added exact WebSocket-origin
checks, request validation, queue limits, per-client rate limits, and a hard container ceiling so
one visitor cannot leave the inference service running indefinitely.

## Tech stack

- **Model and backend:** Python, PyTorch, Hugging Face Transformers, FastAPI, WebSockets
- **Frontend:** React, Three.js, React Three Fiber, Vite
- **Projection and hosting:** NumPy, UMAP, Modal, Vercel
