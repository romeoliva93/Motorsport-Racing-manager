"""
Foto realistiche della moto di ogni squadra, nella sua livrea e nella sua categoria. Gratis, in locale
(SDXL-Turbo, vedi docs/ASSETS_E_LICENZE.md).

Procedura (nessuna scritta sulle carene, forma identica all'illustrazione → zone dei componenti precise):
  1. node tools/portraits/render-liveries.cjs   → disegno della moto nei colori della squadra (out/liveries/)
  2. python3 tools/portraits/teambikes.py       → il generatore lo rende fotorealistico (immagine → immagine,
                                                   forza 0,7) in out/teambikes/<squadra>-v<n>.webp
  3. scelta della variante migliore in teams-choice.json, poi --install copia nel gioco
     (apps/client/src/assets/teambikes/<squadra>.webp)
Numero del pilota e nome sono elementi grafici sovrapposti dal gioco, mai scritti dal generatore.
"""
import argparse, hashlib, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from generate import color_name  # noqa: E402

TIERS = {
    'premier': 'MotoGP prototype racing motorcycle with large aerodynamic winglets and carbon fiber parts',
    'intermediate': 'Moto2 racing motorcycle with a 765cc three-cylinder engine',
    'lightweight': 'Moto3 small 250cc racing motorcycle',
    'rookies': 'small 250cc junior cup racing motorcycle, identical spec bike',
}
TMP = os.path.join(HERE, 'out', 'teambikes')
OUT = os.path.join(ROOT, 'apps', 'client', 'src', 'assets', 'teambikes')


def prompt(t):
    c1, c2 = color_name(t['primary']), color_name(t['secondary'])
    paint = 'blue white and red' if t['tier'] == 'rookies' else (c1 if c1 == c2 else f'{c1} and {c2}')
    return (f'photorealistic studio photo of a {TIERS[t["tier"]]}, side view, glossy {paint} paint, '
            'carbon fibre details, slick tyres, brake discs, golden fork, smooth clean bodywork, dark studio, '
            'soft reflections, sharp')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--install', action='store_true')
    ap.add_argument('--variants', type=int, default=2)
    a = ap.parse_args()
    teams = json.load(open(os.path.join(HERE, 'teams.json')))
    if a.install:
        choice = json.load(open(os.path.join(HERE, 'teams-choice.json')))
        os.makedirs(OUT, exist_ok=True)
        for t in teams:
            v = choice.get(t['key'])
            if v is None:
                continue
            shutil.copy(os.path.join(TMP, f'{t["key"]}-v{v}.webp'), os.path.join(OUT, f'{t["key"]}.webp'))
        print('installate', len([t for t in teams if choice.get(t['key']) is not None]))
        return
    os.makedirs(TMP, exist_ok=True)
    todo = [(t, v) for t in teams for v in range(a.variants) if not os.path.exists(os.path.join(TMP, f'{t["key"]}-v{v}.webp'))]
    if not todo:
        print('Niente da generare.')
        return
    import torch
    from PIL import Image
    from diffusers import AutoPipelineForImage2Image
    torch.set_num_threads(os.cpu_count() or 4)
    pipe = AutoPipelineForImage2Image.from_pretrained('stabilityai/sdxl-turbo', dtype=torch.bfloat16, variant='fp16')
    pipe.set_progress_bar_config(disable=True)
    for i, (t, v) in enumerate(todo, 1):
        base = os.path.join(HERE, 'out', 'liveries', f'{t["key"]}.png')
        if not os.path.exists(base):
            sys.exit(f'Manca {base}: esegui prima node tools/portraits/render-liveries.cjs')
        src = Image.open(base).convert('RGB').resize((768, 432))
        seed = int(hashlib.sha256(f'{t["key"]}-{v}'.encode()).hexdigest()[:8], 16)
        img = pipe(prompt=prompt(t), image=src, strength=0.7, num_inference_steps=4, guidance_scale=0.0,
                   generator=torch.Generator('cpu').manual_seed(seed)).images[0]
        img.convert('RGB').save(os.path.join(TMP, f'{t["key"]}-v{v}.webp'), quality=84)
        print(f'[{i}/{len(todo)}] {t["key"]} v{v}', flush=True)


if __name__ == '__main__':
    sys.exit(main())
