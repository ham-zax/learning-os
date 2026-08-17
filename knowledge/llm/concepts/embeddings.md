# Embeddings and Vector Space

## Summary
An embedding is a learned dense vector for a discrete symbol. The embedding matrix turns token IDs into points in a high-dimensional space where geometric relationships (distance, direction) encode semantic ones. Everything downstream in a transformer operates on these vectors.

## Key Points

### The embedding matrix
- Shape `[vocab_size, d_model]` — e.g. `[128256, 4096]` for a Llama-class model, which is ~525M parameters just for the lookup table.
- The "lookup" is mathematically a one-hot vector times the matrix, but implemented as an array index.
- Randomly initialised, then trained by backprop like any other weight. Nothing about the initial vectors is meaningful.

### The distributional hypothesis
"You shall know a word by the company it keeps" (Firth, 1957). Words appearing in similar contexts get similar vectors, because the training objective pushes them to make similar predictions. This is the entire reason embeddings encode meaning at all.

### Static vs contextual
- **Static** (word2vec, GloVe): one vector per word, forever. `bank` has a single vector averaging river-bank and money-bank.
- **Contextual** (ELMo, BERT, every LLM): the input embedding is static, but each transformer layer rewrites it based on surrounding tokens. By the final layer, `bank` in "river bank" and "bank loan" occupy different regions. **This is the thing attention buys you.**

### Geometry and similarity
- **Cosine similarity** is the standard metric — it measures direction, ignoring magnitude. Magnitude in LLM embeddings correlates with token frequency, which you usually want to ignore.
- **Vector arithmetic** (`king - man + woman ≈ queen`) works in word2vec-style spaces. It is much weaker in LLM hidden states and is a poor mental model for them.
- **Anisotropy**: raw LLM hidden states occupy a narrow cone, so nearly all pairs have high cosine similarity. Purpose-trained embedding models (`sentence-transformers`, `bge`, `e5`) fix this with contrastive training — which is why you use them for retrieval instead of pulling hidden states out of a chat model.

### Weight tying
Many models share the input embedding matrix with the output projection (the "unembedding" that produces logits). This halves parameters and usually helps quality. Note that some models tie and some don't — it affects how you interpret the output layer.

### Embeddings for retrieval
The practical use outside LLM internals: encode documents once, encode a query at runtime, retrieve by nearest neighbour in a vector index (FAISS, hnswlib, pgvector). This is the "R" in RAG. Key parameters: embedding dimension, normalisation, and whether the model was trained with asymmetric query/document prefixes (many require literal `"query: "` / `"passage: "` prefixes — omitting them quietly degrades recall).

## Gotchas
- Cosine similarity of raw decoder hidden states is nearly useless for semantic search. Use a dedicated embedding model.
- Embedding dimension is not quality — a well-trained 384-dim model routinely beats a poorly-trained 1536-dim one on retrieval benchmarks.
- Embeddings from different models live in unrelated spaces. Never mix vectors from two models in one index; re-embed the whole corpus when you switch.
- Forgetting to L2-normalise before a dot-product index turns your "cosine" search into a magnitude-biased one.
- Long documents must be chunked before embedding. A single vector cannot represent 50 pages; retrieval quality is dominated by chunking strategy far more often than by model choice.
