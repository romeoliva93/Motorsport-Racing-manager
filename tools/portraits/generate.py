"""
Ritratti fotorealistici dei personaggi di LEAN ANGLE, generati in locale e gratis.

Modello: SDXL-Turbo (stabilityai/sdxl-turbo), 4 passi, 512x512, funziona anche senza scheda grafica.
Licenza del modello: Stability AI Community License (gratuita sotto 1 milione di dollari di ricavi annui).

Uso:
  bash tools/portraits/setup.sh                       # una volta: installa le librerie (gratis)
  node tools/portraits/export.ts                      # elenco dei personaggi del mondo fisso
  python3 tools/portraits/generate.py --kind rider --limit 8   # prova su 8 piloti
  python3 tools/portraits/generate.py                 # tutti (riprende da dove si è fermato)

Ogni ritratto usa un seme ricavato dalla sua chiave: rigenerando si ottiene lo stesso volto.
I file vanno in apps/client/src/assets/portraits/<chiave>.webp (384x384): il gioco li trova da solo alla
compilazione successiva.
"""
import argparse, hashlib, json, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'apps', 'client', 'src', 'assets', 'portraits')

REGIONS = {
    'south': ['ITA', 'ESP', 'POR', 'SMR', 'FRA', 'TUR'],
    'north': ['GER', 'AUT', 'SUI', 'NED', 'BEL', 'DEN', 'NOR', 'SWE', 'POL', 'CZE', 'HUN', 'GBR'],
    'latin': ['ARG', 'BRA', 'MEX'],
    'japan': ['JPN'],
    'sea': ['THA', 'INA', 'MAS'],
    'anglo': ['AUS', 'USA'],
    'africa': ['RSA', 'NGR'],
}
NATIONALITY = {
    'ITA': 'Italian', 'ESP': 'Spanish', 'POR': 'Portuguese', 'SMR': 'Sammarinese', 'FRA': 'French', 'TUR': 'Turkish',
    'GER': 'German', 'AUT': 'Austrian', 'SUI': 'Swiss', 'NED': 'Dutch', 'BEL': 'Belgian', 'DEN': 'Danish',
    'NOR': 'Norwegian', 'SWE': 'Swedish', 'POL': 'Polish', 'CZE': 'Czech', 'HUN': 'Hungarian', 'GBR': 'British',
    'ARG': 'Argentinian', 'BRA': 'Brazilian', 'MEX': 'Mexican', 'JPN': 'Japanese', 'THA': 'Thai',
    'INA': 'Indonesian', 'MAS': 'Malaysian', 'AUS': 'Australian', 'USA': 'American', 'RSA': 'South African',
    'NGR': 'Nigerian',
}
HAIR = {
    'south': ['dark brown', 'black', 'brown', 'dark brown'],
    'north': ['blond', 'light brown', 'brown', 'dark blond', 'red', 'brown'],
    'latin': ['black', 'dark brown', 'brown'],
    'japan': ['black', 'black', 'dark brown'],
    'sea': ['black', 'black'],
    'anglo': ['blond', 'brown', 'dark brown', 'light brown', 'black'],
    'africa': ['black', 'black', 'dark brown'],
}
EYES = {'north': ['blue', 'grey', 'green', 'brown'], 'anglo': ['blue', 'brown', 'green', 'hazel']}
STYLE_M = ['short cropped hair', 'short messy hair', 'undercut hairstyle', 'buzz cut', 'short wavy hair', 'slicked back short hair']
STYLE_F = ['hair tied back in a ponytail', 'shoulder-length hair', 'short bob haircut', 'braided hair']
BEARD = ['clean-shaven', 'clean-shaven', 'light stubble', 'short trimmed beard', 'stubble']
COLORS = {
    'red': (200, 30, 40), 'dark red': (120, 20, 30), 'orange': (240, 120, 30), 'yellow': (245, 200, 30),
    'green': (40, 150, 70), 'dark green': (20, 80, 50), 'teal': (20, 160, 160), 'light blue': (90, 170, 230),
    'blue': (30, 90, 220), 'navy blue': (20, 35, 90), 'purple': (120, 60, 200), 'magenta': (200, 40, 160),
    'pink': (235, 100, 150), 'white': (240, 240, 240), 'silver grey': (170, 175, 180), 'black': (25, 25, 28),
    'gold': (200, 160, 60), 'brown': (110, 70, 40),
}


def color_name(hex_):
    n = int(hex_[1:], 16)
    rgb = ((n >> 16) & 255, (n >> 8) & 255, n & 255)
    return min(COLORS, key=lambda k: sum((a - b) ** 2 for a, b in zip(COLORS[k], rgb)))


def art(word):
    return 'an' if word[0] in 'aeiou' else 'a'


def region(nat):
    for k, v in REGIONS.items():
        if nat in v:
            return k
    return 'south'


def seed_of(key):
    return int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)


def prompt_for(p):
    h = seed_of(p['key'])
    reg = region(p['nationality'])
    who_age = p['age']
    sex = 'woman' if p['female'] else ('boy' if who_age < 18 else 'man')
    if p['female'] and who_age < 18:
        sex = 'girl'
    hair = HAIR[reg][h % len(HAIR[reg])]
    style = (STYLE_F if p['female'] else STYLE_M)[(h >> 4) % (4 if p['female'] else 6)]
    eyes = EYES.get(reg, ['brown', 'dark brown', 'hazel'])[(h >> 8) % len(EYES.get(reg, ['brown', 'dark brown', 'hazel']))]
    if who_age >= 45 and (h >> 12) % 3 == 0:
        hair = 'greying ' + hair
    beard = '' if p['female'] or who_age < 19 else BEARD[(h >> 16) % len(BEARD)] + ', '
    c1, c2 = color_name(p['primary']), color_name(p['secondary'])
    if p.get('organizer'):
        outfit = 'wearing the official junior cup team jacket, yellow and black, identical for every rider'
    elif p['kind'] == 'pool':
        outfit = 'wearing a plain black motorcycle racing team polo shirt'
    elif p['kind'] == 'staff':
        extra = ', radio headset around the neck' if p['role'] in ('trackEngineer', 'crewChief') else ''
        outfit = f'wearing {art(c1)} {c1} and {c2} motorcycle racing team softshell jacket with small sponsor logos{extra}'
    else:
        outfit = f'wearing {art(c1)} {c1} and {c2} motorcycle racing team polo shirt with small sponsor logos'
    job = {
        'rider': 'professional motorcycle racer',
        'staff': {'crewChief': 'motorcycle racing crew chief', 'trackEngineer': 'motorcycle racing track engineer',
                  'technicalDirector': 'motorcycle racing technical director',
                  'sportingDirector': 'motorcycle racing team manager'}.get(p['role'], 'motorcycle racing engineer'),
        'pool': 'young motorcycle racer',
    }[p['kind']]
    return (
        f"official paddock press photo, head and shoulders portrait of a {who_age}-year-old "
        f"{NATIONALITY.get(p['nationality'], '')} {sex}, {job}, {hair} {style}, {eyes} eyes, {beard}"
        f"{outfit}, looking at the camera, natural confident expression, motorsport team garage softly blurred "
        f"in the background, soft natural light, 85mm lens, shallow depth of field, photorealistic, "
        f"realistic skin texture, high detail, sharp focus"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kind', choices=['rider', 'staff', 'pool'])
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--only', help='genera solo questa chiave')
    ap.add_argument('--model', default='stabilityai/sdxl-turbo')
    ap.add_argument('--steps', type=int, default=4)
    ap.add_argument('--force', action='store_true', help='rigenera anche i ritratti esistenti')
    ap.add_argument('--print', action='store_true', help='stampa solo i prompt')
    a = ap.parse_args()

    roster = json.load(open(os.path.join(ROOT, 'tools', 'portraits', 'roster.json')))
    order = {'rider': 0, 'staff': 1, 'pool': 2}
    roles = {'race': 0, 'technicalDirector': 1, 'crewChief': 2, 'trackEngineer': 3, 'test': 4, 'reserve': 5, 'academy': 6}
    todo = [p for p in roster if (not a.kind or p['kind'] == a.kind) and (not a.only or p['key'] == a.only)]
    todo.sort(key=lambda p: (order[p['kind']], p.get('organizer', False), roles.get(p['role'], 9), p['key']))
    os.makedirs(OUT, exist_ok=True)
    todo = [p for p in todo if a.force or not os.path.exists(os.path.join(OUT, p['key'] + '.webp'))]
    if a.limit:
        todo = todo[: a.limit]
    if a.print:
        for p in todo:
            print(p['key'], '|', prompt_for(p))
        return
    if not todo:
        print('Niente da generare.')
        return

    import torch
    from diffusers import AutoPipelineForText2Image

    torch.set_num_threads(os.cpu_count() or 4)
    # variante fp16: download dimezzato (~7 GB), poi i calcoli su CPU in float32
    pipe = AutoPipelineForText2Image.from_pretrained(a.model, torch_dtype=torch.float32, variant='fp16')
    pipe.set_progress_bar_config(disable=True)
    t0 = time.time()
    for i, p in enumerate(todo, 1):
        g = torch.Generator('cpu').manual_seed(seed_of(p['key']))
        img = pipe(prompt=prompt_for(p), num_inference_steps=a.steps, guidance_scale=0.0,
                   width=512, height=512, generator=g).images[0]
        img.resize((384, 384)).save(os.path.join(OUT, p['key'] + '.webp'), quality=82)
        el = time.time() - t0
        print(f'[{i}/{len(todo)}] {p["key"]}  ({el / i:.0f} s/ritratto)', flush=True)


if __name__ == '__main__':
    sys.exit(main())
