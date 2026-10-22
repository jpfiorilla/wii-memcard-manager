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

/** Per-costume stock icons live in public/charactericons/<slug>/<costume>.png (0 = default). */
export function CharacterIcon({
  ckind,
  costume = 0,
  size = 20,
}: {
  ckind: number;
  costume?: number;
  size?: number;
}) {
  const entry = CHARACTERS[ckind];
  if (!entry) return null;
  const [slug, label] = entry;
  return (
    <Box
      component="img"
      src={`${import.meta.env.BASE_URL}charactericons/${slug}/${costume}.png`}
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        if (!img.src.endsWith("/0.png")) img.src = `${import.meta.env.BASE_URL}charactericons/${slug}/0.png`;
      }}
      alt={label}
      draggable={false}
      sx={{ width: size, height: size, imageRendering: "pixelated", display: "block", flexShrink: 0 }}
    />
  );
}

/** "Marth vs Falco" pair: you on the left, the CPU on the right. */
export function MatchupIcons({
  hmn,
  hmnCostume = 0,
  cpu,
  cpuCostume = 0,
  name,
  size = 20,
}: {
  hmn: number;
  hmnCostume?: number;
  cpu: number;
  cpuCostume?: number;
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
        <CharacterIcon ckind={hmn} costume={hmnCostume} size={size} />
        <Box component="span" sx={{ fontSize: 10, color: "text.secondary", px: 0.25 }}>
          vs
        </Box>
        <CharacterIcon ckind={cpu} costume={cpuCostume} size={size} />
      </Box>
    </Tooltip>
  );
}
