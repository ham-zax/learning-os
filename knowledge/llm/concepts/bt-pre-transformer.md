# Breakthrough: word2vec to seq2seq + Attention (2013-2015)

## Summary
Three ideas arrived in three years that made the transformer possible: that meaning can live in a dense vector, that a variable-length sequence can be mapped to another variable-length sequence, and that a decoder should be allowed to look back at the input rather than work from a single summary vector.

## Key Points

### word2vec (Mikolov et al., 2013)
- Trained shallow networks on a fake task (predict context from word, or word from context) purely to extract the hidden layer as embeddings.
- **Skip-gram with negative sampling** made this fast enough to run on billions of words on a CPU.
- Result: dense vectors where cosine similarity tracked semantic similarity, and `king − man + woman ≈ queen` worked.
- **Why it mattered**: it demonstrated that useful representations could be learned from raw unlabeled text at scale. Every later "pretraining" argument descends from this.
- GloVe (2014) reached similar vectors via matrix factorisation on co-occurrence counts, confirming the result wasn't an artifact of the method.

### seq2seq (Sutskever, Vinyals, Le, 2014)
- Encoder RNN reads the input sentence into a fixed-size hidden vector; decoder RNN generates the output from it.
- First credible end-to-end neural machine translation — no phrase tables, no alignment models, no hand-built pipeline.
- **The fatal flaw**: everything had to squeeze through one fixed-size vector. Quality degraded sharply with sentence length. The paper's own trick — reversing the source sentence to shorten the path to the first words — is a tell that the bottleneck was the problem.

### Attention (Bahdanau, Cho, Bengio, 2015)
- Let the decoder compute, at each output step, a weighted sum over **all** encoder hidden states, with weights predicted from the current decoder state.
- The bottleneck disappears. Long-sentence translation quality stopped degrading.
- Attention weights visualised as an alignment matrix produced recognisable word alignments — the first widely-shared "the network learned something interpretable" result.
- Luong et al. (2015) simplified the scoring function to a dot product — the direct ancestor of scaled dot-product attention.

### Why the RNN had to go
Even with attention, recurrence forced sequential computation: step `t` needs step `t−1`. On a GPU built for parallel matrix multiplication, this wastes the hardware. It also made gradients traverse `O(n)` steps between distant tokens, so long-range dependencies were hard to learn even with LSTM gating. Attention already provided a constant-length path. The obvious question — *what if attention were the whole model?* — was answered in 2017.

## Gotchas
- word2vec embeddings are static. Confusing them with contextual embeddings (BERT, LLM hidden states) is a common conceptual error — the whole point of the transformer era is that the vector changes with context.
- Bahdanau attention is *cross*-attention (decoder→encoder). Self-attention as the primary computation was the 2017 leap, not this one.
- The famous analogy results (`king − man + woman`) were later shown to be partly an artifact of how the nearest-neighbour search excludes the input words. The effect is real but weaker than the popular account.
- ELMo (2018) sits between these eras: contextual embeddings from a bidirectional LSTM. Historically important, architecturally a dead end.
