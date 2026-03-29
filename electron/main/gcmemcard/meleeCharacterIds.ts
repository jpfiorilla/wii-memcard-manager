/**
 * Super Smash Bros. Melee external character IDs (in-game / VS results style).
 * TM:CE (GTME) replay tooling uses the same roster IDs for compatibility.
 */
export enum MeleeExternalCharacterId {
  Mario = 0,
  Fox = 1,
  CaptainFalcon = 2,
  DonkeyKong = 3,
  Kirby = 4,
  Bowser = 5,
  Link = 6,
  Sheik = 7,
  Ness = 8,
  Peach = 9,
  IceClimbers = 10,
  Nana = 11,
  Pikachu = 12,
  Jigglypuff = 13,
  DrMario = 14,
  YoungLink = 15,
  Falco = 16,
  Samus = 17,
  Pichu = 18,
  MrGameAndWatch = 19,
  Marth = 20,
  Roy = 21,
  Mewtwo = 22,
  Zelda = 23,
  Ganondorf = 24,
}

/** Human-readable names for UI / logs (subset of roster). */
export const MELEE_CHARACTER_LABEL: Record<MeleeExternalCharacterId, string> = {
  [MeleeExternalCharacterId.Mario]: "Mario",
  [MeleeExternalCharacterId.Fox]: "Fox",
  [MeleeExternalCharacterId.CaptainFalcon]: "Falcon",
  [MeleeExternalCharacterId.DonkeyKong]: "DK",
  [MeleeExternalCharacterId.Kirby]: "Kirby",
  [MeleeExternalCharacterId.Bowser]: "Bowser",
  [MeleeExternalCharacterId.Link]: "Link",
  [MeleeExternalCharacterId.Sheik]: "Sheik",
  [MeleeExternalCharacterId.Ness]: "Ness",
  [MeleeExternalCharacterId.Peach]: "Peach",
  [MeleeExternalCharacterId.IceClimbers]: "Icies",
  [MeleeExternalCharacterId.Nana]: "Nana",
  [MeleeExternalCharacterId.Pikachu]: "Pikachu",
  [MeleeExternalCharacterId.Jigglypuff]: "Puff",
  [MeleeExternalCharacterId.DrMario]: "Doc",
  [MeleeExternalCharacterId.YoungLink]: "Yink",
  [MeleeExternalCharacterId.Falco]: "Falco",
  [MeleeExternalCharacterId.Samus]: "Samus",
  [MeleeExternalCharacterId.Pichu]: "Pichu",
  [MeleeExternalCharacterId.MrGameAndWatch]: "GnW",
  [MeleeExternalCharacterId.Marth]: "Marth",
  [MeleeExternalCharacterId.Roy]: "Roy",
  [MeleeExternalCharacterId.Mewtwo]: "Mewtwo",
  [MeleeExternalCharacterId.Zelda]: "Zelda",
  [MeleeExternalCharacterId.Ganondorf]: "Ganon",
};

/**
 * Canonical **very short** Latin slug per roster ID for TM:CE / GTME dentry filenames (hyphen style).
 * This is the single map from character → short name used when sanitizing with `tmce-short`.
 * Sheik and Zelda both use `sheik` (TM:CE almost always uses Sheik).
 */
export const MELEE_CHARACTER_SHORT_SLUG: Record<
  MeleeExternalCharacterId,
  string
> = {
  [MeleeExternalCharacterId.Mario]: "mario",
  [MeleeExternalCharacterId.Fox]: "fox",
  [MeleeExternalCharacterId.CaptainFalcon]: "cf",
  [MeleeExternalCharacterId.DonkeyKong]: "dk",
  [MeleeExternalCharacterId.Kirby]: "kirby",
  [MeleeExternalCharacterId.Bowser]: "bow",
  [MeleeExternalCharacterId.Link]: "link",
  [MeleeExternalCharacterId.Sheik]: "sheik",
  [MeleeExternalCharacterId.Ness]: "ness",
  [MeleeExternalCharacterId.Peach]: "peach",
  [MeleeExternalCharacterId.IceClimbers]: "ics",
  [MeleeExternalCharacterId.Nana]: "nana",
  [MeleeExternalCharacterId.Pikachu]: "pika",
  [MeleeExternalCharacterId.Jigglypuff]: "puff",
  [MeleeExternalCharacterId.DrMario]: "doc",
  [MeleeExternalCharacterId.YoungLink]: "yl",
  [MeleeExternalCharacterId.Falco]: "falco",
  [MeleeExternalCharacterId.Samus]: "samus",
  [MeleeExternalCharacterId.Pichu]: "pichu",
  [MeleeExternalCharacterId.MrGameAndWatch]: "gnw",
  [MeleeExternalCharacterId.Marth]: "marth",
  [MeleeExternalCharacterId.Roy]: "roy",
  [MeleeExternalCharacterId.Mewtwo]: "m2",
  [MeleeExternalCharacterId.Zelda]: "sheik",
  [MeleeExternalCharacterId.Ganondorf]: "ganon",
};

export function canonicalShortSlugForMeleeId(
  id: MeleeExternalCharacterId,
): string {
  return MELEE_CHARACTER_SHORT_SLUG[id];
}

/** First path segment in filenames like `dk-low-upB` from rwing exports (lowercase). */
const SLUG_TO_ID: Record<string, MeleeExternalCharacterId> = {
  mario: MeleeExternalCharacterId.Mario,
  fox: MeleeExternalCharacterId.Fox,
  cf: MeleeExternalCharacterId.CaptainFalcon,
  falcon: MeleeExternalCharacterId.CaptainFalcon,
  dk: MeleeExternalCharacterId.DonkeyKong,
  donkey: MeleeExternalCharacterId.DonkeyKong,
  kirby: MeleeExternalCharacterId.Kirby,
  bowser: MeleeExternalCharacterId.Bowser,
  link: MeleeExternalCharacterId.Link,
  sheik: MeleeExternalCharacterId.Sheik,
  ness: MeleeExternalCharacterId.Ness,
  peach: MeleeExternalCharacterId.Peach,
  ics: MeleeExternalCharacterId.IceClimbers,
  ic: MeleeExternalCharacterId.IceClimbers,
  nana: MeleeExternalCharacterId.Nana,
  pichu: MeleeExternalCharacterId.Pichu,
  pika: MeleeExternalCharacterId.Pikachu,
  pikachu: MeleeExternalCharacterId.Pikachu,
  puff: MeleeExternalCharacterId.Jigglypuff,
  jigglypuff: MeleeExternalCharacterId.Jigglypuff,
  doc: MeleeExternalCharacterId.DrMario,
  drmario: MeleeExternalCharacterId.DrMario,
  ylink: MeleeExternalCharacterId.YoungLink,
  yl: MeleeExternalCharacterId.YoungLink,
  falco: MeleeExternalCharacterId.Falco,
  samus: MeleeExternalCharacterId.Samus,
  gnw: MeleeExternalCharacterId.MrGameAndWatch,
  gw: MeleeExternalCharacterId.MrGameAndWatch,
  marth: MeleeExternalCharacterId.Marth,
  roy: MeleeExternalCharacterId.Roy,
  mewtwo: MeleeExternalCharacterId.Mewtwo,
  /** TM:CE lists Sheik; treat `zelda` as Sheik for filenames and hints. */
  zelda: MeleeExternalCharacterId.Sheik,
  ganon: MeleeExternalCharacterId.Ganondorf,
  ganondorf: MeleeExternalCharacterId.Ganondorf,
};

/** Map a slug (e.g. `dk` from `dk-low-upB`) to a roster ID, or null if unknown. */
export function meleeCharacterIdFromSlug(
  slug: string,
): MeleeExternalCharacterId | null {
  const k = slug.toLowerCase();
  return SLUG_TO_ID[k] ?? null;
}
