"""
Immagini realistiche (originali, senza marchi) delle moto di ogni costruttore e categoria. Gratis, in locale.

Stesso modello dei ritratti (SDXL-Turbo, licenza Stability AI Community). Uscita:
apps/client/src/assets/bikes/<costruttore>-<categoria>.webp (768x432). Il gioco le trova da solo.
  python3 tools/portraits/bikes.py            # genera quelle mancanti
  python3 tools/portraits/bikes.py --force    # rigenera tutto
"""
import argparse, hashlib, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'apps', 'client', 'src', 'assets', 'bikes')

# colore di fabbrica (originale) e carattere della moto di ogni costruttore
MAKERS = {
    'ardena': ('deep red and black', 'aggressive sharp fairing'),
    'hoshiro': ('white and navy blue', 'smooth rounded fairing'),
    'takaido': ('metallic blue and silver', 'slim compact fairing'),
    'vohrmann': ('orange and dark grey', 'angular fairing'),
    'corvane': ('teal and white', 'futuristic fairing'),
    'lysander': ('green and black', 'light simple fairing'),
    'navarra': ('yellow and black', 'clean fairing'),
    'bertoldi': ('dark green and white', 'slender fairing'),
    'hollis': ('purple and silver', 'simple fairing'),
}
TIERS = {
    'premier': 'MotoGP prototype racing motorcycle with large aerodynamic winglets and carbon fiber parts',
    'intermediate': 'Moto2 racing motorcycle with a 765cc three-cylinder engine',
    'lightweight': 'Moto3 small 250cc racing motorcycle',
    'rookies': 'small 250cc junior cup racing motorcycle, yellow and black, identical spec bike',
}
CATS = {
    'ardena': ['premier'], 'hoshiro': ['premier', 'lightweight'], 'takaido': ['premier', 'lightweight'],
    'vohrmann': ['premier'], 'corvane': ['premier', 'lightweight'], 'lysander': ['lightweight', 'rookies'],
    'navarra': ['intermediate'], 'bertoldi': ['intermediate'], 'hollis': ['intermediate'],
}


def prompt(maker, tier):
    col, style = MAKERS[maker]
    paint = '' if tier == 'rookies' else f'{col} paint, '
    return (f'photorealistic studio photo, full side view of a {TIERS[tier]}, {paint}{style}, plain bodywork, '
            f'slick racing tyres, dark grey studio background, soft reflections, sharp focus, high detail')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--print', action='store_true')
    a = ap.parse_args()
    todo = [(m, t) for m, ts in CATS.items() for t in ts]
    os.makedirs(OUT, exist_ok=True)
    todo = [x for x in todo if a.force or not os.path.exists(os.path.join(OUT, f'{x[0]}-{x[1]}.webp'))]
    if a.print:
        for m, t in todo:
            print(m, t, '|', prompt(m, t))
        return
    if not todo:
        print('Niente da generare.')
        return
    import torch
    from diffusers import AutoPipelineForText2Image
    torch.set_num_threads(os.cpu_count() or 4)
    pipe = AutoPipelineForText2Image.from_pretrained('stabilityai/sdxl-turbo', dtype=torch.bfloat16, variant='fp16')
    pipe.set_progress_bar_config(disable=True)
    for i, (m, t) in enumerate(todo, 1):
        seed = int(hashlib.sha256(f'{m}-{t}'.encode()).hexdigest()[:8], 16)
        img = pipe(prompt=prompt(m, t), num_inference_steps=4, guidance_scale=0.0, width=768, height=432,
                   generator=torch.Generator('cpu').manual_seed(seed)).images[0]
        img.convert('RGB').save(os.path.join(OUT, f'{m}-{t}.webp'), quality=84)
        print(f'[{i}/{len(todo)}] {m}-{t}', flush=True)


if __name__ == '__main__':
    sys.exit(main())
