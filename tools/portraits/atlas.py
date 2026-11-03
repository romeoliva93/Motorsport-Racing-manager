"""
Raccoglie i ritratti in pochi fogli (atlanti) per il gioco: apps/client/src/assets/atlas/sheet-<n>.webp
(12×12 ritratti da 192 px) e index.json {chiave: [foglio, colonna, riga]}.

Sorgenti, in ordine di precedenza:
  1. ritratti nuovi o rigenerati in tools/portraits/out/portraits/<chiave>.webp (prodotti da generate.py);
  2. la casella già presente negli atlanti attuali (così non servono gli originali nel repository).
Ogni personaggio di tools/portraits/roster.json deve avere un ritratto: lo script si ferma se ne manca uno.
  python3 tools/portraits/atlas.py            ricostruisce tutti i fogli (ordine alfabetico)
  python3 tools/portraits/atlas.py --inplace  sostituisce solo le caselle cambiate: i personaggi tolti dal roster
                                              lasciano la casella ai nuovi; si riscrivono solo i fogli toccati
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
NEW = os.path.join(HERE, 'out', 'portraits')
OUT = os.path.join(ROOT, 'apps', 'client', 'src', 'assets', 'atlas')
CELL, COLS = 192, 12
PER = COLS * COLS


def inplace():
    roster = json.load(open(os.path.join(HERE, 'roster.json')))
    keys = {p['key'] for p in roster}
    idx = json.load(open(os.path.join(OUT, 'index.json')))
    m = idx['map']
    freed = sorted((v for k, v in m.items() if k not in keys), key=lambda v: tuple(v))
    for k in [k for k in m if k not in keys]:
        del m[k]
    new = sorted(k for k in keys if k not in m)
    redo = sorted(k for k in keys if k in m and os.path.exists(os.path.join(NEW, f'{k}.webp')))
    if len(new) > len(freed):
        sys.exit(f'{len(new)} ritratti nuovi ma solo {len(freed)} caselle libere: usa la ricostruzione completa')
    missing = [k for k in new if not os.path.exists(os.path.join(NEW, f'{k}.webp'))]
    if missing:
        sys.exit(f'Ritratti mancanti: {missing}… generali con generate.py')
    for k, cell in zip(new, freed):
        m[k] = cell
    touched = {}
    for k in new + redo:
        sh, c, r = m[k]
        if sh not in touched:
            touched[sh] = Image.open(os.path.join(OUT, f'sheet-{sh}.webp')).convert('RGB')
        img = Image.open(os.path.join(NEW, f'{k}.webp')).convert('RGB').resize((CELL, CELL), Image.LANCZOS)
        touched[sh].paste(img, (c * CELL, r * CELL))
    for sh, im in touched.items():
        im.save(os.path.join(OUT, f'sheet-{sh}.webp'), quality=90)
    json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
    print(f'{len(new)} nuovi, {len(redo)} rigenerati; fogli riscritti: {sorted(touched)}')


def main():
    if '--inplace' in sys.argv:
        return inplace()
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
