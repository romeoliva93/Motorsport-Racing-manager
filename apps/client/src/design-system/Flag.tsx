/**
 * Bandiere nazionali (SVG di flag-icons, licenza MIT — https://github.com/lipis/flag-icons).
 * I codici del gioco sono a 3 lettere (ITA, ESP, …) e vengono mappati sui codici ISO 3166-1 dei file.
 * Ogni bandiera è un file separato: il browser scarica solo quelle mostrate.
 */
import arg from 'flag-icons/flags/4x3/ar.svg?url';
import aus from 'flag-icons/flags/4x3/au.svg?url';
import aut from 'flag-icons/flags/4x3/at.svg?url';
import bel from 'flag-icons/flags/4x3/be.svg?url';
import bra from 'flag-icons/flags/4x3/br.svg?url';
import cze from 'flag-icons/flags/4x3/cz.svg?url';
import den from 'flag-icons/flags/4x3/dk.svg?url';
import esp from 'flag-icons/flags/4x3/es.svg?url';
import fra from 'flag-icons/flags/4x3/fr.svg?url';
import gbr from 'flag-icons/flags/4x3/gb.svg?url';
import ger from 'flag-icons/flags/4x3/de.svg?url';
import hun from 'flag-icons/flags/4x3/hu.svg?url';
import ina from 'flag-icons/flags/4x3/id.svg?url';
import ita from 'flag-icons/flags/4x3/it.svg?url';
import jpn from 'flag-icons/flags/4x3/jp.svg?url';
import mas from 'flag-icons/flags/4x3/my.svg?url';
import mex from 'flag-icons/flags/4x3/mx.svg?url';
import ned from 'flag-icons/flags/4x3/nl.svg?url';
import ngr from 'flag-icons/flags/4x3/ng.svg?url';
import nor from 'flag-icons/flags/4x3/no.svg?url';
import pol from 'flag-icons/flags/4x3/pl.svg?url';
import por from 'flag-icons/flags/4x3/pt.svg?url';
import rsa from 'flag-icons/flags/4x3/za.svg?url';
import smr from 'flag-icons/flags/4x3/sm.svg?url';
import sui from 'flag-icons/flags/4x3/ch.svg?url';
import swe from 'flag-icons/flags/4x3/se.svg?url';
import tha from 'flag-icons/flags/4x3/th.svg?url';
import tur from 'flag-icons/flags/4x3/tr.svg?url';
import uae from 'flag-icons/flags/4x3/ae.svg?url';
import usa from 'flag-icons/flags/4x3/us.svg?url';
import { country } from '../i18n/it.ts';

const FLAGS: Record<string, string> = {
  ARG: arg,
  AUS: aus,
  AUT: aut,
  BEL: bel,
  BRA: bra,
  CZE: cze,
  DEN: den,
  ESP: esp,
  FRA: fra,
  GBR: gbr,
  GER: ger,
  HUN: hun,
  INA: ina,
  ITA: ita,
  JPN: jpn,
  MAS: mas,
  MEX: mex,
  NED: ned,
  NGR: ngr,
  NOR: nor,
  POL: pol,
  POR: por,
  RSA: rsa,
  SMR: smr,
  SUI: sui,
  SWE: swe,
  THA: tha,
  TUR: tur,
  UAE: uae,
  USA: usa,
};

export function Flag({ code, size = 1.1, title = true }: { code: string; size?: number; title?: boolean }) {
  const src = FLAGS[code];
  const name = country(code);
  if (!src) return <span className="flag-missing">{code}</span>;
  return (
    <img
      className="flag"
      src={src}
      alt={name}
      title={title ? name : undefined}
      width={Math.round((size * 16 * 4) / 3)}
      height={Math.round(size * 16)}
      style={{ width: `${(size * 4) / 3}rem`, height: `${size}rem` }}
      loading="lazy"
      decoding="async"
    />
  );
}

/** Bandiera seguita dal nome del paese. */
export function FlagName({ code, size }: { code: string; size?: number }) {
  return (
    <span className="flag-name">
      <Flag code={code} size={size} title={false} />
      {country(code)}
    </span>
  );
}
