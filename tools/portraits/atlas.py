"""
Unisce i ritratti in pochi fogli (atlanti) per il gioco: 4 file al posto di centinaia, caricamento più rapido.
Sorgenti: apps/client/src/assets/portraits/*.webp (384×384). Uscita: apps/client/src/assets/atlas/
  sheet-<n>.webp (12×12 ritratti da 192 px) e index.json {chiave: [foglio, colonna, riga]}.
Da rilanciare dopo aver generato o rigenerato ritratti:  python3 tools/portraits/atlas.py
"""
import glob, json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'apps', 'client', 'src', 'assets', 'portraits')
OUT = os.path.join(ROOT, 'apps', 'client', 'src', 'assets', 'atlas')
CELL, COLS = 192, 12
PER = COLS * COLS

files = sorted(glob.glob(os.path.join(SRC, '*.webp')))
os.makedirs(OUT, exist_ok=True)
for old in glob.glob(os.path.join(OUT, 'sheet-*.webp')):
    os.remove(old)
index = {}
for s in range(0, len(files), PER):
    part = files[s:s + PER]
    rows = (len(part) + COLS - 1) // COLS
    sheet = Image.new('RGB', (CELL * COLS, CELL * rows), (20, 22, 26))
    for i, f in enumerate(part):
        c, r = i % COLS, i // COLS
        sheet.paste(Image.open(f).convert('RGB').resize((CELL, CELL), Image.LANCZOS), (c * CELL, r * CELL))
        index[os.path.basename(f)[:-5]] = [s // PER, c, r]
    sheet.save(os.path.join(OUT, f'sheet-{s // PER}.webp'), quality=80)
json.dump({'cols': COLS, 'rows': {str(k): (min(PER, len(files) - k * PER) + COLS - 1) // COLS for k in range((len(files) + PER - 1) // PER)}, 'map': index},
          open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
print(f'{len(files)} ritratti in {(len(files) + PER - 1) // PER} fogli')
