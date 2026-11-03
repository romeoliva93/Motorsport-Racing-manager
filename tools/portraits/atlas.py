"""
Raccoglie i ritratti in pochi fogli (atlanti) per il gioco: apps/client/src/assets/atlas/sheet-<n>.webp
(12×12 ritratti da 192 px) e index.json {chiave: [foglio, colonna, riga]}.

Sorgenti, in ordine di precedenza:
  1. ritratti nuovi o rigenerati in tools/portraits/out/portraits/<chiave>.webp (prodotti da generate.py);
  2. la casella già presente negli atlanti attuali (così non servono gli originali nel repository).
Ogni personaggio di tools/portraits/roster.json deve avere un ritratto: lo script si ferma se ne manca uno.
  python3 tools/portraits/atlas.py
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
NEW = os.path.join(HERE, 'out', 'portraits')
OUT = os.path.join(ROOT, 'apps', 'client', 'src', 'assets', 'atlas')
CELL, COLS = 192, 12
PER = COLS * COLS


def main():
    roster = json.load(open(os.path.join(HERE, 'roster.json')))
    keys = sorted({p['key'] for p in roster})
    old_index = json.load(open(os.path.join(OUT, 'index.json'))) if os.path.exists(os.path.join(OUT, 'index.json')) else {'map': {}}
    sheets = {}

    def from_atlas(key):
        sh, c, r = old_index['map'][key]
        if sh not in sheets:
            sheets[sh] = Image.open(os.path.join(OUT, f'sheet-{sh}.webp')).convert('RGB')
        return sheets[sh].crop((c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL))

    cells = {}
    missing = []
    for k in keys:
        f = os.path.join(NEW, f'{k}.webp')
        if os.path.exists(f):
            cells[k] = Image.open(f).convert('RGB').resize((CELL, CELL), Image.LANCZOS)
        elif k in old_index['map']:
            cells[k] = from_atlas(k)
        else:
            missing.append(k)
    if missing:
        sys.exit(f'Ritratti mancanti ({len(missing)}): {missing[:5]}… generali con generate.py')
    for k in keys:  # carica tutto prima di sovrascrivere i fogli
        cells[k].load()
    index = {}
    n_sheets = (len(keys) + PER - 1) // PER
    for old in [f for f in os.listdir(OUT) if f.startswith('sheet-')]:
        os.remove(os.path.join(OUT, old))
    for sh in range(n_sheets):
        part = keys[sh * PER:(sh + 1) * PER]
        rows = (len(part) + COLS - 1) // COLS
        sheet = Image.new('RGB', (CELL * COLS, CELL * rows), (20, 22, 26))
        for i, k in enumerate(part):
            c, r = i % COLS, i // COLS
            sheet.paste(cells[k], (c * CELL, r * CELL))
            index[k] = [sh, c, r]
        sheet.save(os.path.join(OUT, f'sheet-{sh}.webp'), quality=80)
    rows = {str(sh): (min(PER, len(keys) - sh * PER) + COLS - 1) // COLS for sh in range(n_sheets)}
    json.dump({'cols': COLS, 'rows': rows, 'map': index}, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
    print(f'{len(keys)} ritratti in {n_sheets} fogli')


if __name__ == '__main__':
    main()
