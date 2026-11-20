"""
Immagini originali dei gruppi tecnici del garage (prodotti fotografati in studio, senza marchi). Gratis, in locale.
Uscita: apps/client/src/assets/parts/<gruppo>.webp (512×512). Stesso modello dei ritratti (vedi docs/ASSETS_E_LICENZE.md).
  python3 tools/portraits/parts.py [--force]
"""
import argparse, hashlib, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'apps', 'client', 'src', 'assets', 'parts')
STYLE = ('product photo on a plain dark graphite studio background, soft rim light, centered, sharp focus, '
         'photorealistic, high detail, no text, no logo')
PARTS = {
    'powertrain': 'isolated racing motorcycle V4 engine block on an engine stand, gearbox and titanium exhaust headers, no motorcycle',
    'chassis': 'isolated bare polished aluminium twin spar motorcycle racing frame and swingarm, no wheels, no engine, no bodywork',
    'suspension': 'gold racing motorcycle front fork and rear shock absorber with spring',
    'brakes': 'carbon ceramic motorcycle brake disc with gold radial brake caliper',
    'aero': 'motorcycle racing front fairing with aerodynamic winglets, carbon fibre',
    'electronics': 'motorcycle racing ECU control unit with wiring harness and connectors',
    'balance': 'motorcycle racing adjustable triple clamp and rear ride height adjuster tools',
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    todo = [k for k in PARTS if a.force or not os.path.exists(os.path.join(OUT, f'{k}.webp'))]
    if not todo:
        print('Niente da generare.')
        return
    import torch
    from diffusers import AutoPipelineForText2Image
    torch.set_num_threads(os.cpu_count() or 4)
    pipe = AutoPipelineForText2Image.from_pretrained('stabilityai/sdxl-turbo', dtype=torch.bfloat16, variant='fp16')
    pipe.set_progress_bar_config(disable=True)
    for k in todo:
        for v in range(3):  # tre varianti: si sceglie la migliore a occhio
            seed = int(hashlib.sha256(f'{k}-{v}'.encode()).hexdigest()[:8], 16)
            img = pipe(prompt=f'{PARTS[k]}, {STYLE}', num_inference_steps=4, guidance_scale=0.0, width=512,
                       height=512, generator=torch.Generator('cpu').manual_seed(seed)).images[0]
            img.convert('RGB').save(os.path.join(OUT, f'{k}{"" if v == 0 else f"-v{v}"}.webp'), quality=84)
            print(f'[{k} v{v}]', flush=True)


if __name__ == '__main__':
    sys.exit(main())
