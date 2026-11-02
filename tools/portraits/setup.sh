#!/usr/bin/env bash
# Installa (gratis) le librerie per generare i ritratti senza scheda grafica.
# Serve accesso di rete a download.pytorch.org e a huggingface.co (vedi docs/ASSET_PIPELINE.md).
set -euo pipefail
python3 -m pip install --quiet torch --index-url https://download.pytorch.org/whl/cpu
python3 -m pip install --quiet "diffusers>=0.30" transformers accelerate safetensors pillow
echo "Pronto. Prova: python3 tools/portraits/generate.py --kind rider --limit 8"
