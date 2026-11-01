/*
 * Ritratti illustrati procedurali (prototipo per i mockup).
 * Separazione richiesta dal design:
 *   identità (seed → tratti del volto, fissi per tutta la carriera)
 *   ritratto (volto, capelli, età, espressione)
 *   abbigliamento (tuta/polo nei colori della squadra attuale)
 * Nel gioco una fotografia PNG associata al personaggio sostituisce il ritratto illustrato.
 *
 * Uso: <div class="avatar" data-seed="teo-varriale" data-suit="#2a6cf0,#0d1530" data-age="24"
 *            data-kind="rider|staff" data-sex="m|f" data-num="27"></div>
 * Se data-seed manca si usa il testo dell'elemento (le iniziali).
 */
(function () {
  function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = hash(seed); return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SKIN = ['#f3d2b8', '#eac0a0', '#d9a77f', '#c68e63', '#a8704a', '#8a5636', '#6b4029'];
  const HAIR = ['#1c1410', '#2e1f16', '#4a3020', '#6b4428', '#8f6a3e', '#b89058', '#d8bb84', '#2a2a2a'];
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function firstColor(el) {
    const bg = getComputedStyle(el).backgroundImage || '';
    const m = bg.match(/rgba?\([^)]*\)|#[0-9a-f]{3,6}/i);
    return m ? m[0] : '#2a6cf0';
  }

  function svg(o) {
    const r = rng(o.seed);
    const skin = o.skin || pick(r, SKIN);
    const age = o.age || 20 + Math.floor(r() * 35);
    const grey = age > 45 ? Math.min(1, (age - 45) / 15) : 0;
    let hair = o.hair || pick(r, HAIR);
    if (grey > .3) hair = grey > .7 ? '#c9c9c9' : '#8d8a85';
    const f = o.sex === 'f' || (!o.sex && r() < .28);
    const style = f ? pick(r, ['long', 'bob', 'tied']) : pick(r, ['short', 'buzz', 'curly', 'side', 'messy', age > 50 ? 'bald' : 'short']);
    const beard = !f && r() < (o.kind === 'staff' ? .45 : .25);
    const smile = r();
    const [c1, c2] = o.suit;
    const faceW = f ? 30 : 32, jaw = f ? 0 : 3;
    const eyeY = 54, eyeDX = 11 + r() * 1.5;
    const brow = f ? 1.6 : 2.4;
    const id = 'p' + hash(o.seed);
    let hairBack = '', hairFront = '';
    if (style === 'long') { hairBack = `<path d="M18 50 Q14 90 26 104 L74 104 Q86 90 82 50 Q80 20 50 18 Q20 20 18 50Z" fill="${hair}"/>`; hairFront = `<path d="M20 52 Q22 24 50 22 Q78 24 80 52 Q70 34 50 34 Q34 34 20 52Z" fill="${hair}"/>`; }
    else if (style === 'bob') { hairBack = `<path d="M18 48 Q16 78 24 84 L76 84 Q84 78 82 48 Q80 20 50 18 Q20 20 18 48Z" fill="${hair}"/>`; hairFront = `<path d="M20 50 Q24 22 52 22 Q78 24 80 50 Q66 30 40 36 Q28 40 20 50Z" fill="${hair}"/>`; }
    else if (style === 'tied') { hairBack = `<circle cx="50" cy="16" r="8" fill="${hair}"/>`; hairFront = `<path d="M20 50 Q22 22 50 21 Q78 22 80 50 Q74 32 50 30 Q28 31 20 50Z" fill="${hair}"/>`; }
    else if (style === 'buzz') { hairFront = `<path d="M20 48 Q22 22 50 21 Q78 22 80 48 Q72 32 50 31 Q28 32 20 48Z" fill="${hair}" opacity=".85"/>`; }
    else if (style === 'curly') { hairFront = `<g fill="${hair}">${[22,30,38,46,54,62,70,78].map((x,i)=>`<circle cx="${x}" cy="${30 - Math.sin(i/7*Math.PI)*8}" r="8"/>`).join('')}<path d="M18 50 Q20 30 30 28 L70 28 Q80 30 82 50 Q72 38 50 38 Q28 38 18 50Z"/></g>`; }
    else if (style === 'side') { hairFront = `<path d="M19 50 Q18 22 48 19 Q80 20 81 46 Q76 30 58 30 Q40 34 30 30 Q24 38 19 50Z" fill="${hair}"/>`; }
    else if (style === 'messy') { hairFront = `<path d="M19 50 L22 30 L28 34 L32 20 L40 28 L46 16 L52 26 L60 17 L64 28 L72 22 L74 34 L81 32 L81 50 Q72 36 50 36 Q28 36 19 50Z" fill="${hair}"/>`; }
    else if (style === 'bald') { hairFront = `<path d="M18 56 Q19 44 24 40 L24 58Z M82 56 Q81 44 76 40 L76 58Z" fill="${hair}"/>`; }
    else { hairFront = `<path d="M19 50 Q20 22 50 20 Q80 22 81 50 Q76 32 50 30 Q24 32 19 50Z" fill="${hair}"/>`; }
    const mouth = smile > .66 ? `<path d="M42 77 Q50 84 58 77" stroke="#5a2e22" stroke-width="2" fill="none" stroke-linecap="round"/>`
      : smile > .33 ? `<path d="M43 78 Q50 81 57 78" stroke="#5a2e22" stroke-width="2" fill="none" stroke-linecap="round"/>`
      : `<path d="M43 79 L57 79" stroke="#5a2e22" stroke-width="2" stroke-linecap="round"/>`;
    const lines = age > 38 ? `<path d="M33 66 Q36 70 35 74 M67 66 Q64 70 65 74" stroke="rgba(0,0,0,.18)" stroke-width="1.2" fill="none"/>` : '';
    const stubble = beard ? `<path d="M${50-faceW+4} 66 Q${50-faceW+6} 92 50 96 Q${50+faceW-6} 92 ${50+faceW-4} 66 Q62 84 50 85 Q38 84 ${50-faceW+4} 66Z" fill="${hair}" opacity="${grey>.3?.55:.5}"/>` : '';
    const suitDetail = o.kind === 'rider'
      ? `<path d="M30 112 L42 100 L50 110 L58 100 L70 112" stroke="${c2}" stroke-width="5" fill="none"/><path d="M8 126 L26 106" stroke="#fff" stroke-width="3" opacity=".55"/><path d="M92 126 L74 106" stroke="#fff" stroke-width="3" opacity=".55"/>${o.num ? `<text x="78" y="124" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="800" font-size="13" fill="#fff" text-anchor="middle">${o.num}</text>` : ''}`
      : `<path d="M38 100 L50 114 L62 100" fill="#fff" opacity=".9"/><path d="M38 100 L50 114 L62 100" stroke="${c2}" stroke-width="2" fill="none"/>`;
    return `<svg viewBox="0 0 100 128" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMin slice" style="width:100%;height:100%;display:block">
      <defs><radialGradient id="${id}b" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${c1}" stop-opacity=".55"/><stop offset="1" stop-color="#0b0d12"/></radialGradient>
      <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
      <rect width="100" height="128" fill="url(#${id}b)"/>
      ${hairBack}
      <path d="M2 128 Q4 104 30 98 L70 98 Q96 104 98 128Z" fill="url(#${id}s)"/>
      ${suitDetail}
      <rect x="42" y="82" width="16" height="18" fill="${skin}"/><rect x="42" y="88" width="16" height="6" fill="rgba(0,0,0,.12)"/>
      <path d="M${50-faceW} 52 Q${50-faceW} ${88+jaw} 50 ${92+jaw} Q${50+faceW} ${88+jaw} ${50+faceW} 52 Q${50+faceW} 22 50 22 Q${50-faceW} 22 ${50-faceW} 52Z" fill="${skin}"/>
      <ellipse cx="${50-faceW}" cy="58" rx="4" ry="6" fill="${skin}"/><ellipse cx="${50+faceW}" cy="58" rx="4" ry="6" fill="${skin}"/>
      ${stubble}
      <path d="M${50-eyeDX-6} ${eyeY-7} L${50-eyeDX+5} ${eyeY-8}" stroke="${hair === '#c9c9c9' ? '#8a8a8a' : hair}" stroke-width="${brow}" stroke-linecap="round"/>
      <path d="M${50+eyeDX-5} ${eyeY-8} L${50+eyeDX+6} ${eyeY-7}" stroke="${hair === '#c9c9c9' ? '#8a8a8a' : hair}" stroke-width="${brow}" stroke-linecap="round"/>
      <ellipse cx="${50-eyeDX}" cy="${eyeY}" rx="4" ry="2.6" fill="#fff"/><ellipse cx="${50+eyeDX}" cy="${eyeY}" rx="4" ry="2.6" fill="#fff"/>
      <circle cx="${50-eyeDX}" cy="${eyeY}" r="1.9" fill="#2b1d14"/><circle cx="${50+eyeDX}" cy="${eyeY}" r="1.9" fill="#2b1d14"/>
      <path d="M50 58 Q47 68 49 70 L52 70" stroke="rgba(0,0,0,.25)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      ${mouth}${lines}
      ${hairFront}
    </svg>`;
  }

  // Segnaposto fotografico neutro (usato finché non esiste la foto del personaggio).
  function placeholder(o) {
    const [c1] = o.suit; const id = 'ph' + hash(o.seed);
    return `<svg viewBox="0 0 100 128" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f3a"/><stop offset="1" stop-color="#14171e"/></linearGradient></defs>
      <rect width="100" height="128" fill="url(#${id})"/>
      <circle cx="50" cy="50" r="19" fill="#3a404d"/>
      <path d="M14 128 Q16 88 50 84 Q84 88 86 128Z" fill="#3a404d"/>
      <path d="M14 128 Q16 100 30 94 L70 94 Q84 100 86 128Z" fill="${c1}" opacity=".55"/>
      <text x="50" y="121" font-family="Inter,sans-serif" font-size="7" fill="#a9b0bf" text-anchor="middle" letter-spacing="1">FOTO</text>
    </svg>`;
  }

  // Ordine: 1) fotografia assets/portraits/<seed>.jpg  2) segnaposto fotografico.
  // Il ritratto illustrato (svg) resta disponibile solo con data-style="illustrated".
  function render() {
    document.querySelectorAll('.avatar, .portrait').forEach(el => {
      if (el.dataset.done) return;
      const seed = el.dataset.seed || el.textContent.trim() || 'x';
      const suit = el.dataset.suit ? el.dataset.suit.split(',') : [firstColor(el), '#0b0d12'];
      const skin = el.dataset.skin ? (SKIN[+el.dataset.skin] || el.dataset.skin) : undefined;
      const hair = el.dataset.hair ? (HAIR[+el.dataset.hair] || el.dataset.hair) : undefined;
      const o = { seed, suit, skin, hair, age: +el.dataset.age || 0, sex: el.dataset.sex, kind: el.dataset.kind || 'staff', num: el.dataset.num };
      el.style.overflow = 'hidden';
      el.dataset.done = '1';
      if (el.dataset.style === 'illustrated') { el.innerHTML = svg(o); return; }
      el.innerHTML = placeholder(o);
      if (!el.dataset.seed) return;
      const img = new Image();
      img.onload = () => { el.innerHTML = ''; img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:50% 20%;display:block'; el.appendChild(img); };
      img.src = 'assets/portraits/' + seed + '.jpg';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
