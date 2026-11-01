#!/usr/bin/env bash
# Scarica i file del modello FLUX.1-schnell (licenza Apache 2.0) in formato compresso GGUF
# per l'esecuzione su CPU con stable-diffusion.cpp. ~11 GB in totale.
# Richiede accesso di rete a huggingface.co e ai suoi host di download (*.huggingface.co, *.hf.co).
# I modelli NON vanno nel repository: la cartella è esclusa da .gitignore.
set -euo pipefail
DIR="${MODELS_DIR:-$HOME/models/flux-schnell}"
mkdir -p "$DIR"
get() { # url file
  if [ -s "$DIR/$2" ]; then echo "già presente: $2"; return; fi
  echo "scarico $2 ..."
  curl -fL --retry 4 --retry-delay 3 -o "$DIR/$2.part" "$1" && mv "$DIR/$2.part" "$DIR/$2"
}
get "https://huggingface.co/city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q4_K_S.gguf" flux1-schnell-Q4_K_S.gguf
get "https://huggingface.co/city96/t5-v1_1-xxl-encoder-gguf/resolve/main/t5-v1_1-xxl-encoder-Q5_K_M.gguf" t5xxl-Q5_K_M.gguf
get "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors" clip_l.safetensors
get "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors" ae.safetensors
ls -lh "$DIR"
