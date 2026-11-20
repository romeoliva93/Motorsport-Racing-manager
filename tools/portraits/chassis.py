"""
Immagine del gruppo "Telaio" del garage: un telaio isolato, non una moto intera.
Il modello testo→immagine disegna sempre moto complete, quindi si parte da un disegno della sagoma
(telaio a doppia trave + forcellone, fatto qui con PIL) e lo si rende fotorealistico con img2img
(SDXL-Turbo, in locale, gratis; licenza in docs/ASSETS_E_LICENZE.md). Poi si centra e si ritaglia.
  python3 tools/portraits/chassis.py   → apps/client/src/assets/parts/chassis.webp
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'apps', 'client', 'src', 'assets', 'parts', 'chassis.webp')
PROMPT = ('isolated bare polished brushed aluminium twin spar motorcycle racing frame with swingarm, welded joints, '
          'product photo on a plain dark graphite studio background, soft rim light, photorealistic, high detail, '
          'no wheels, no engine, no bodywork, no text, no logo')


def sketch():
    W,H=1024,1024
    img=Image.new('RGB',(W,H))
    d=ImageDraw.Draw(img)
    for y in range(H):
        c=int(28+22*(y/H)); d.line([(0,y),(W,y)],fill=(c,c,c+3))
    def poly(pts,fill,outline=None,w=0):
        d.polygon(pts,fill=fill,outline=outline)
    alu=(178,182,188); dark=(110,114,120); hi=(225,228,232)
    # steering head (tilted tube)
    poly([(250,250),(290,240),(330,420),(290,430)],dark)
    poly([(262,250),(282,246),(318,420),(300,424)],hi)
    # main spar (upper beam) from head to pivot
    poly([(300,270),(640,330),(720,470),(690,520),(600,420),(320,380)],alu)
    poly([(310,280),(630,338),(700,460),(690,470),(610,370),(318,320)],hi)
    # lower beam / engine hanger
    poly([(320,380),(600,420),(690,520),(650,560),(560,470),(330,430)],dark)
    # pivot plates
    poly([(640,420),(740,440),(760,640),(660,660),(620,520)],alu)
    d.ellipse([(670,500),(740,570)],fill=(70,72,76)); d.ellipse([(690,520),(720,550)],fill=hi)
    # subframe (thin tubes) to the rear
    for off in (0,22):
        d.line([(700,440+off),(920,380+off)],fill=dark,width=14)
    d.line([(740,560),(920,420)],fill=dark,width=12)
    # swingarm (cast, braced)
    poly([(700,520),(940,650),(950,700),(705,575)],alu)
    poly([(705,575),(950,700),(930,720),(700,610)],dark)
    poly([(720,520),(820,470),(920,640),(900,655),(810,500),(740,548)],alu)  # top brace
    poly([(712,528),(935,656),(938,668),(712,540)],hi)
    d.ellipse([(905,650),(975,720)],fill=(60,62,66)); d.ellipse([(925,670),(955,700)],fill=hi)
    # bolts
    for (x,y) in [(360,300),(470,320),(580,345),(660,440),(720,610)]:
        d.ellipse([(x-8,y-8),(x+8,y+8)],fill=(60,62,66))
    img=img.filter(ImageFilter.GaussianBlur(1.2))
    return img


def main():
    import torch
    from diffusers import AutoPipelineForImage2Image
    torch.set_num_threads(os.cpu_count() or 4)
    pipe = AutoPipelineForImage2Image.from_pretrained('stabilityai/sdxl-turbo', dtype=torch.bfloat16, variant='fp16')
    pipe.set_progress_bar_config(disable=True)
    src = sketch().convert('RGB').resize((512, 512))
    g = torch.Generator('cpu').manual_seed(1000)
    im = pipe(prompt=PROMPT, image=src, strength=0.7, num_inference_steps=4, guidance_scale=0.0, generator=g).images[0]
    a = np.asarray(im.convert('L')).astype(int)
    ys, xs = np.where(np.abs(a - np.median(a)) > 28)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    side = max(xs.max() - xs.min(), ys.max() - ys.min()) * 1.18
    im.crop((int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))) \
      .resize((512, 512), Image.LANCZOS).save(OUT, quality=86)
    print('scritto', OUT)


if __name__ == '__main__':
    main()
