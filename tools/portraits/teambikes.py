"""
Foto realistiche della moto di ogni squadra, nella sua livrea (colori della scuderia) e nella sua categoria.
Gratis, in locale (SDXL-Turbo, vedi docs/ASSETS_E_LICENZE.md). 2 varianti per squadra: si sceglie la migliore
(file teams-choice.json) e la scelta finisce in apps/client/src/assets/teambikes/<squadra>.webp.
  python3 tools/portraits/teambikes.py            # genera le varianti mancanti in tools/portraits/out/teambikes
  python3 tools/portraits/teambikes.py --install  # copia le varianti scelte nel gioco
"""
import argparse, hashlib, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from generate import color_name  # noqa: E402
from bikes import TIERS  # noqa: E402

TMP = os.path.join(HERE, 'out', 'teambikes')
OUT = os.path.join(ROOT, 'apps', 'client', 'src', 'assets', 'teambikes')


def prompt(t):
    c1, c2 = color_name(t['primary']), color_name(t['secondary'])
    livery = 'blue white and red' if t['tier'] == 'rookies' else (c1 if c1 == c2 else f'{c1} and {c2}')
    return (f'photorealistic studio photo, full side view of a {TIERS[t["tier"]]} on a paddock stand, '
            f'{livery} racing livery, race fairing without headlights or mirrors, slick tyres, '
            f'dark garage background, studio light, sharp, high detail')


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
    from diffusers import AutoPipelineForText2Image
    torch.set_num_threads(os.cpu_count() or 4)
    pipe = AutoPipelineForText2Image.from_pretrained('stabilityai/sdxl-turbo', dtype=torch.bfloat16, variant='fp16')
    pipe.set_progress_bar_config(disable=True)
    for i, (t, v) in enumerate(todo, 1):
        seed = int(hashlib.sha256(f'{t["key"]}-{v}'.encode()).hexdigest()[:8], 16)
        img = pipe(prompt=prompt(t), num_inference_steps=4, guidance_scale=0.0, width=768, height=432,
                   generator=torch.Generator('cpu').manual_seed(seed)).images[0]
        img.convert('RGB').save(os.path.join(TMP, f'{t["key"]}-v{v}.webp'), quality=84)
        print(f'[{i}/{len(todo)}] {t["key"]} v{v}', flush=True)


if __name__ == '__main__':
    sys.exit(main())
