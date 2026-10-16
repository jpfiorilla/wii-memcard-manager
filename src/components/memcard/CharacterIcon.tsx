import { Box, Tooltip } from "@mui/material";

/** Melee external character IDs (CKIND order, MexTK fighter.h) → icon file + label. */
const CHARACTERS: ReadonlyArray<readonly [slug: string, label: string]> = [
  ["captain-falcon", "Captain Falcon"],
  ["donkey-kong", "DK"],
  ["fox", "Fox"],
  ["game-and-watch", "Game & Watch"],
  ["kirby", "Kirby"],
  ["bowser", "Bowser"],
  ["link", "Link"],
  ["luigi", "Luigi"],
  ["mario", "Mario"],
  ["marth", "Marth"],
  ["mewtwo", "Mewtwo"],
  ["ness", "Ness"],
  ["peach", "Peach"],
  ["pikachu", "Pikachu"],
  ["ice-climbers", "Ice Climbers"],
  ["jigglypuff", "Jigglypuff"],
  ["samus", "Samus"],
  ["yoshi", "Yoshi"],
  ["zelda", "Zelda"],
  ["sheik", "Sheik"],
  ["falco", "Falco"],
  ["young-link", "Young Link"],
  ["dr-mario", "Dr. Mario"],
  ["roy", "Roy"],
  ["pichu", "Pichu"],
  ["ganondorf", "Ganondorf"],
];

export function characterLabel(ckind: number): string | null {
  return CHARACTERS[ckind]?.[1] ?? null;
}

export function CharacterIcon({ ckind, size = 20 }: { ckind: number; size?: number }) {
  const entry = CHARACTERS[ckind];
  if (!entry) return null;
  const [slug, label] = entry;
  return (
    <Box
      component="img"
      src={`${import.meta.env.BASE_URL}charactericons/${slug}.png`}
      alt={label}
      draggable={false}
      sx={{ width: size, height: size, imageRendering: "pixelated", display: "block", flexShrink: 0 }}
    />
  );
}

/** "Marth vs Falco" pair: you on the left, the CPU on the right. */
export function MatchupIcons({
  hmn,
  cpu,
  name,
  size = 20,
}: {
  hmn: number;
  cpu: number;
  name?: string;
  size?: number;
}) {
  const a = characterLabel(hmn);
  const b = characterLabel(cpu);
  if (!a || !b) return null;
  const title = `${a} (you) vs ${b} (CPU)${name ? ` — “${name}”` : ""}`;
  return (
    <Tooltip title={title}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }} aria-label={title}>
        <CharacterIcon ckind={hmn} size={size} />
        <Box component="span" sx={{ fontSize: 10, color: "text.secondary", px: 0.25 }}>
          vs
        </Box>
        <CharacterIcon ckind={cpu} size={size} />
      </Box>
    </Tooltip>
  );
}
