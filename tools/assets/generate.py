#!/usr/bin/env python3
"""
Generatore degli asset fotorealistici di LEAN ANGLE (eseguito in locale, su CPU).

Modello: FLUX.1-schnell (Apache 2.0) in formato GGUF tramite stable-diffusion.cpp.
Input:   tools/assets/manifest.json (identità visive permanenti: seed + aspetto + squadra)
Output per ogni soggetto, in assets/<cartella>/<id>/:
  master.png        immagine originale (riferimento permanente dell'identità)
  web.webp          versione ottimizzata per l'interfaccia (lato lungo 1024 px)
  thumb.webp        miniatura (lato lungo 256 px)
  meta.json         prompt, seed, modello, impostazioni, hash: permette di rigenerare identico
Cache: se meta.json esiste con lo stesso hash del prompt/impostazioni, il soggetto viene saltato.

Uso:
  python tools/assets/generate.py --only rdr-teo-varriale        # un soggetto
  python tools/assets/generate.py --kind people                   # tutti i personaggi
  python tools/assets/generate.py --kind bikes                    # tutte le moto
  python tools/assets/generate.py --force --only ...              # rigenera ignorando la cache
  python tools/assets/generate.py --seed-offset 1 --only ...      # nuova variante (nuovo seed)
"""
import argparse, hashlib, json, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "tools/assets/manifest.json"
MODELS = Path(os.environ.get("MODELS_DIR", Path.home() / "models/flux-schnell"))
MODEL_ID = "FLUX.1-schnell Q4_K_S (GGUF) · stable-diffusion.cpp"

PORTRAIT_W, PORTRAIT_H = 768, 960   # 4:5
BIKE_W, BIKE_H = 1152, 768          # 3:2
STEPS = 4                           # schnell: 4 passi

NEG = ""  # FLUX schnell non usa prompt negativi (cfg 1.0)


def person_prompt(p, team):
    age = p["age"]
    if p["kind"] == "rider":
        outfit = (f"wearing a {team['colors']} one-piece leather motorcycle racing suit with padded shoulder armour, "
                  f"visible stitching, perforated leather panels, small fictional sponsor patches reading {team['sponsor']}, "
                  f"race number {p['number']} embroidered on the chest, collar zipped up")
        role = "professional motorcycle racer" if p["folder"] != "rookies" else "junior motorcycle racer of a one-make youth racing series"
        bg = "softly blurred motorcycle racing team garage with tool trolleys and team-coloured panels"
    else:
        outfit = (f"wearing a {team['colors']} team technical polo shirt with a small fictional {team['sponsor']} logo, "
                  f"a team lanyard pass around the neck, a radio headset resting around the neck")
        role = f"motorcycle racing team {p['role']}"
        bg = "softly blurred motorcycle racing pit box with laptops showing telemetry graphs"
    return (f"Official championship portrait photograph of a {age}-year-old {p['nat']} {role}. "
            f"{p['look']}. {outfit}. Head and shoulders framing, slight three-quarter angle, looking at the camera. "
            f"Background: {bg}, shallow depth of field, bokeh. Professional photo lighting with soft key light, "
            f"85mm lens, natural skin texture with pores, detailed hair, sharp natural eyes, photorealistic, "
            f"editorial sports photography. No helmet, no real brand logos.")


def bike_prompt(b, team, view):
    return (f"Professional studio photograph of a {b['design']}. {b['livery']}. Race number {b['number']} on the front "
            f"fairing and on the tail. {view} view of the whole motorcycle, centred, entire bike in frame. "
            f"Dark grey studio with a subtle reflective floor, soft professional product lighting, realistic materials: "
            f"glossy paint, exposed carbon fibre, machined aluminium, rubber tyres. Photorealistic, highly detailed. "
            f"No rider, no real brand logos.")


def h(*parts):
    return hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:16]


def save_outputs(img, outdir, meta):
    from PIL import Image
    outdir.mkdir(parents=True, exist_ok=True)
    img.save(outdir / "master.png", optimize=True)
    for name, size in (("web.webp", 1024), ("thumb.webp", 256)):
        im = img.copy()
        im.thumbnail((size, size), Image.LANCZOS)
        im.save(outdir / name, "WEBP", quality=82, method=6)
    (outdir / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))


def load_sd():
    from stable_diffusion_cpp import StableDiffusion
    return StableDiffusion(
        diffusion_model_path=str(MODELS / "flux1-schnell-Q4_K_S.gguf"),
        clip_l_path=str(MODELS / "clip_l.safetensors"),
        t5xxl_path=str(MODELS / "t5xxl-Q5_K_M.gguf"),
        vae_path=str(MODELS / "ae.safetensors"),
        vae_decode_only=True,
        n_threads=os.cpu_count() or 4,
    )


def run(sd, prompt, w, h_, seed):
    t = time.time()
    imgs = sd.generate_image(prompt=prompt, width=w, height=h_, sample_steps=STEPS, cfg_scale=1.0,
                             sample_method="euler", seed=seed)
    print(f"    {time.time() - t:.0f}s", flush=True)
    return imgs[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--kind", choices=["people", "bikes", "all"], default="all")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--seed-offset", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true", help="stampa i prompt senza generare")
    a = ap.parse_args()
    m = json.loads(MANIFEST.read_text())
    jobs = []
    if a.kind in ("people", "all"):
        for p in m["people"]:
            team = m["teams"][p["team"]]
            pr = person_prompt(p, team)
            jobs.append((p["id"], ROOT / "assets" / p["folder"] / p["id"], pr, PORTRAIT_W, PORTRAIT_H, p["seed"], {"person": p["name"], "team": p["team"]}))
    if a.kind in ("bikes", "all"):
        for b in m["bikes"]:
            team = m["teams"][b["team"]]
            for v in b["views"]:
                vid = v.replace(" ", "-")
                pr = bike_prompt(b, team, v)
                jobs.append((b["id"], ROOT / "assets/bikes" / b["id"] / vid, pr, BIKE_W, BIKE_H, b["seed"], {"bike": b["id"], "view": v, "team": b["team"]}))
    if a.only:
        jobs = [j for j in jobs if j[0] in a.only]
    if a.dry_run:
        for j in jobs: print(j[0], "\n ", j[2], "\n")
        return
    sd = None
    for jid, outdir, pr, w, hh, seed, extra in jobs:
        seed = seed + a.seed_offset
        key = h(MODEL_ID, pr, w, hh, seed, STEPS)
        metaf = outdir / "meta.json"
        if not a.force and metaf.exists() and json.loads(metaf.read_text()).get("hash") == key:
            print(f"= {outdir.relative_to(ROOT)} (in cache)"); continue
        print(f"+ {outdir.relative_to(ROOT)}", flush=True)
        if sd is None:
            sd = load_sd()
        img = run(sd, pr, w, hh, seed)
        save_outputs(img, outdir, {"id": jid, **extra, "prompt": pr, "seed": seed, "width": w, "height": hh,
                                   "steps": STEPS, "model": MODEL_ID, "hash": key,
                                   "generated": time.strftime("%Y-%m-%d %H:%M")})


if __name__ == "__main__":
    sys.exit(main())
