# Archetypes and concept guide

## Contents
1. The six archetypes (what each is good at, techniques, example file)
2. Concept → picture table (what the figure should make obvious)
3. Facts figures often get wrong

## 1. Archetypes

### Pipeline / computation graph (`assets/examples/autoencoder.tex`)
For: architectures, training set-ups, EBMs, encoder/decoder, GAN, VAE,
residual blocks, unrolled RNNs.
Technique: place nodes with `right=of` / `below=of` and `node distance`,
connect with `\graph[use existing nodes]{a -> b -> c}` or `\draw[flow]`. Use
orthogonal routing (`-|`, `|-`) for skips. Wrap a repeated block in a `group`
box with a "× N" label. Put tensor shapes under variables with `dim`. Draw the
backward pass, if relevant, as `grad` arrows under the forward ones.

### Matrix / heatmap layout (`assets/examples/attention.tex`)
For: attention, matrix products, embeddings lookup, covariance, confusion
matrices, weight matrices, masks (causal attention), batch/layer norm axes.
Technique: nested `\foreach \row [count=\i] in {{...},{...}}` over a list of
lists; name cells `M-i-j`; place multiplicands Falk-style (left and above);
encode values with fill tint `colorX!<pct>!dlbg`; highlight a row/column with
`hl`. Masks: draw masked cells with a faint cross or `dlgrid` fill.

### Grid + receptive field (`assets/examples/convolution.tex`)
For: convolution, pooling, stride/padding/dilation, transposed convolution,
receptive-field growth, patch embedding (ViT).
Technique: cell grids for input, kernel, output; one `hl` patch and the output
cell it produces; the explicit arithmetic for that one cell in a note. Show
padding as faint dashed cells. For stacks of channels use `\dlcuboid`.

### Parameter-space geometry (`assets/examples/momentum.tex`)
For: optimizers (SGD, momentum, Adam), learning rate too big/small, loss
landscapes, L1 vs L2 regularization (diamond vs circle meets contours),
conditioning, saddle points.
Technique: contour lines as ellipses (quadratics) or pgfplots
`\addplot3[contour gnuplot]` is NOT available without shell escape, so prefer
analytic level sets or contours you computed in Python and pasted as
`coordinates`. Trajectories from Python, drawn with `plot coordinates` and dots
at each step. Mark the optimum with a red dot labelled `\vw^\star`.

### Small multiples of plots (`assets/examples/activations.tex`)
For: activations, schedules (learning rate, noise β_t), softmax temperature,
loss curves (train vs val, overfitting), bias–variance, scaling curves.
Technique: pgfplots `groupplot` with shared axis limits; shade the regions that
carry the message (`\fill ... rectangle` in `axis cs`); derivatives dashed in
the same colour as the function. Piecewise functions: give the corner
coordinates explicitly, never rely on sampling.

### Before/after space warp (`assets/examples/linear-map.tex`)
For: what a linear layer does, ReLU folding space, normalizing flows,
whitening/BatchNorm as recentring and rescaling, embeddings becoming linearly
separable, the reparameterization trick (shift and scale of a unit Gaussian).
Technique: same window drawn twice; apply the linear map to a grid with
`cm={a,b,c,d,(0,0)}`; nonlinear maps from Python-computed points. Basis vectors
coloured, and the matrix columns coloured to match.

### Techniques worth reusing across archetypes
- **Thinning arrows**: draw a backward chain with `line width` decreasing in
  proportion to the gradient (or opacity on a log scale) so vanishing is seen,
  not read.
- **Correspondence lines**: thin `dlfaint` lines from each point before a map to
  the same point after it.
- **Path expansion with braces**: under a product like ∏(1 + a_l), expand it and
  put an `\underbrace` label on each term saying which path it is.
- **Shared numbers across panels**: the same input matrix or sample in both
  panels, so the only thing that changes is the thing being explained.

## 2. Concept → picture

| Concept | The picture that makes it click | Archetype |
|---|---|---|
| Backpropagation | small graph (2-3 ops) with forward values above edges and red dashed gradients below, each gradient = upstream × local | pipeline |
| Residual connection | plain stack vs residual stack: backward arrows that thin at each ×J hop vs a constant-width ×1 highway; expand ∏(I+J) into paths, the I term = "skip every block" | pipeline + plot |
| BatchNorm vs LayerNorm | the same (B × d) grid twice, one highlighting a column (per feature, over batch), the other a row (per sample, over features), with real numbers; for CNNs add the GroupNorm-paper cube (N, C, H×W) with the normalized slab shaded | matrix |
| Dropout | the same small MLP twice: train (some units crossed out, survivors scaled 1/(1−p)) and test (all units, no scaling) | pipeline |
| Self-attention | Q Kᵀ → A (row-softmaxed) → A V, one query followed through | matrix |
| Causal mask | the score matrix with the upper triangle masked before softmax | matrix |
| Multi-head attention | d split into h slices, each its own small A, concatenated, then W_O | matrix + pipeline |
| Positional encoding | heatmap of sin/cos over (position × dimension); low dims fast, high dims slow | matrix |
| Convolution | input patch ↔ output cell, kernel shared | grid |
| Receptive field | stacked 3×3 layers, highlighted cone grows 3 → 5 → 7 | grid |
| Pooling / stride | the same grid with stride-2 windows tiled | grid |
| CNN architecture | cuboids shrinking in H, W and growing in C, shapes labelled | pipeline + `\dlcuboid` |
| RNN | folded cell with a self-loop = unrolled chain sharing the same W | pipeline |
| LSTM | cell state as a straight conveyor belt across the top; gates as σ ops that multiply into it | pipeline |
| Autoencoder / bottleneck | x → Enc → h → Dec → x̂ → C, dims show the squeeze | pipeline |
| VAE / reparameterization | (a) sampling node blocks the gradient (red ✗) vs (b) z = μ + σ ⊙ ε with ε ~ N(0, I) entering from the side; then a 1-D panel with lines mapping each ε sample to its z | pipeline + space warp |
| Diffusion | small multiples x₀ → x_t → x_T getting noisier, and the reverse arrows learned | small multiples |
| GAN | G maps z to fake samples; D scores real vs fake; the two opposing losses | pipeline |
| Contrastive / InfoNCE | embedding circle: anchor, positive pulled in, negatives pushed out | space |
| Energy-based model | x, y → F(x, y) landscape; low energy on the data manifold | pipeline + plot |
| Softmax temperature | bar charts of the same logits at T = 0.5, 1, 5 | small multiples |
| Cross-entropy | predicted distribution bars vs one-hot target, loss = −log p of the true class highlighted | small multiples |
| Overfitting | train and validation loss vs epochs, the gap shaded, early-stopping point marked | plot |
| Learning rate | 1-D parabola with steps: too small, good, too big (diverges) | small multiples |
| L1 vs L2 | loss contours meeting the diamond (corner → sparse) vs the circle | geometry |
| Linear layer / ReLU | grid warped by W; then folded onto the positive quadrant | space warp |
| Embeddings | 2-D scatter with clusters and an analogy parallelogram | space |

## 3. Facts figures often get wrong

Check your figure against these before delivering.

- **Attention**: softmax runs over keys, i.e. along each row of QKᵀ when Q, K, V
  are row-per-token; each row of A sums to 1; scale is 1/√d_k; Q, K are
  n×d_k, V is n×d_v, output n×d_v. In a causal mask, query i sees keys ≤ i.
- **Convolution in DL** is cross-correlation (no kernel flip). Output size is
  ⌊(n + 2p − k)/s⌋ + 1. A conv layer kernel has shape (C_out, C_in, k, k): each
  output channel sums over all input channels.
- **BatchNorm** normalizes each channel/feature over the batch (and spatial
  dims for images) and uses running statistics at test time. **LayerNorm**
  normalizes each sample/token over its features, the same at train and test.
  Both then apply a learned scale γ and shift β.
- **Dropout** (inverted, as in PyTorch): at train time zero each unit with
  probability p and scale survivors by 1/(1−p); at test time do nothing.
- **Residual**: y = x + F(x); the shapes of x and F(x) must match (or use a 1×1
  projection on the skip). Pre-LN transformers put LayerNorm inside the branch.
- **LSTM**: c_t = f_t ⊙ c_{t−1} + i_t ⊙ g_t, h_t = o_t ⊙ tanh(c_t); the gates
  use σ, the candidate g uses tanh.
- **VAE**: the encoder outputs μ and log σ² (or σ); z = μ + σ ⊙ ε; loss =
  reconstruction + KL(q(z|x) ‖ N(0, I)). The randomness enters through ε, which
  is why gradients reach μ and σ.
- **Diffusion (DDPM)**: q(x_t|x_0) = N(√ᾱ_t x_0, (1−ᾱ_t) I); the network
  usually predicts the noise ε, not x_0.
- **Momentum**: v ← βv + ∇L, w ← w − ηv (PyTorch form). Adam keeps bias-corrected
  first and second moment estimates and divides elementwise.
- **Cross-entropy with logits**: softmax is part of the loss in PyTorch's
  `CrossEntropyLoss`; do not draw a softmax layer before it as well.
- **Sigmoid derivative** peaks at 1/4, tanh's at 1, which is why deep sigmoid
  stacks shrink gradients by at least 4× per layer.
- **Gradients flow backwards** through the same edges as the forward pass;
  a gradient arrow points from the loss towards the parameters.
