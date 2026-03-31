import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  Box,
  Checkbox,
  FormGroup,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import type { GciFolderEntry, GciPathOverride } from "@/types/memcard";
import { formatFolderRelativeTime } from "@/utils/formatFolderRelativeTime";

type GciCandidateListProps = {
  candidates: GciFolderEntry[];
  selectedPaths: Set<string>;
  pathOverrides: Record<string, GciPathOverride>;
  scanning: boolean;
  gciFolder: string | null;
  rawPath: string | null;
  onPathOverride: (path: string, o: GciPathOverride) => void;
};

export function GciCandidateList({
  candidates,
  selectedPaths,
  pathOverrides,
  scanning,
  gciFolder,
  rawPath,
  onPathOverride,
}: GciCandidateListProps) {
  const theme = useTheme();
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const rowElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const flipFromRectsRef = useRef<Map<string, DOMRect> | null>(null);

  const sorted = useMemo(() => {
    const rows = [...candidates];
    rows.sort((a, b) => {
      const ao = pathOverrides[a.path] ?? "neutral";
      const bo = pathOverrides[b.path] ?? "neutral";
      const aPin = ao === "include" ? 0 : 1;
      const bPin = bo === "include" ? 0 : 1;
      if (aPin !== bPin) return aPin - bPin;
      return (
        b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path, "en")
      );
    });
    return rows;
  }, [candidates, pathOverrides]);

  const handlePathOverride = useCallback(
    (path: string, o: GciPathOverride) => {
      if (!prefersReducedMotion) {
        const m = new Map<string, DOMRect>();
        for (const [p, el] of rowElsRef.current) {
          m.set(p, el.getBoundingClientRect());
        }
        flipFromRectsRef.current = m;
      }
      onPathOverride(path, o);
    },
    [onPathOverride, prefersReducedMotion],
  );

  useLayoutEffect(() => {
    const before = flipFromRectsRef.current;
    flipFromRectsRef.current = null;
    if (!before || before.size === 0 || prefersReducedMotion) return;

    const durationMs = theme.transitions.duration.standard;
    const easing = theme.transitions.easing.easeInOut;

    for (const [p, el] of rowElsRef.current) {
      const old = before.get(p);
      if (!old) continue;
      const next = el.getBoundingClientRect();
      const dy = old.top - next.top;
      if (Math.abs(dy) < 0.5) continue;

      el.style.setProperty("transform", `translateY(${dy}px)`);
      el.style.setProperty("transition", "none");
      el.style.setProperty("will-change", "transform");
      void el.offsetHeight;
      requestAnimationFrame(() => {
        el.style.setProperty(
          "transition",
          `transform ${durationMs}ms ${easing}`,
        );
        el.style.setProperty("transform", "translateY(0)");
        const done = () => {
          el.style.removeProperty("transform");
          el.style.removeProperty("transition");
          el.style.removeProperty("will-change");
          el.removeEventListener("transitionend", done);
        };
        el.addEventListener("transitionend", done, { once: true });
      });
    }
  }, [pathOverrides, prefersReducedMotion, theme.transitions]);

  const hasRows = sorted.length > 0;
  const compactPaneMaxHeight = 240;
  const expandedPaneMaxHeight =
    "min(70vh, 560px, calc(100vh - 320px))";

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flex: hasRows ? 1 : "0 0 auto",
        alignSelf: hasRows ? "stretch" : "flex-start",
        minHeight: 0,
        maxHeight: hasRows ? expandedPaneMaxHeight : `${compactPaneMaxHeight}px`,
        transition: theme.transitions.create("max-height", {
          duration: theme.transitions.duration.standard,
          easing: theme.transitions.easing.sharp,
        }),
        [theme.breakpoints.up(400)]: {
          flex: hasRows ? "2 1 0" : "0 0 auto",
        },
      }}
    >
      <Paper
        sx={{
          p: 2,
          flex: hasRows ? 1 : "0 0 auto",
          minHeight: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          height: hasRows ? "100%" : "auto",
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <Typography variant="subtitle1" gutterBottom>
            Saves
          </Typography>
          <Typography
            variant="caption"
            display="block"
            color="text.secondary"
            sx={{ mb: 1.5 }}
          >
            Override how each file participates in the automatic importable
            picks. The check column shows the resulting plan (read-only).
          </Typography>

          {!scanning && gciFolder && rawPath && candidates.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No saves in this folder.
            </Typography>
          )}

          {!scanning && (!gciFolder || !rawPath) && (
            <Typography variant="body2" color="text.secondary">
              Choose folder and card above.
            </Typography>
          )}
        </Box>

        {hasRows && (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              mt: 0.5,
            }}
          >
            <FormGroup sx={{ gap: 0 }}>
              {sorted.map((c) => {
                const ok = !c.parseError;
                const ov = pathOverrides[c.path] ?? "neutral";
                const checked = ok && selectedPaths.has(c.path);
                const overrideControl = ok ? (
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={ov}
                    onChange={(_, v: GciPathOverride | null) => {
                      if (v == null) return;
                      handlePathOverride(c.path, v);
                    }}
                    aria-label={`Override for ${c.fileName}`}
                    sx={{
                      flexShrink: 0,
                      "& .MuiToggleButton-root": {
                        px: 0.85,
                        py: 0.45,
                        minWidth: 0,
                        transition: (t) =>
                          t.transitions.create(
                            ["background-color", "color", "box-shadow"],
                            { duration: t.transitions.duration.shorter },
                          ),
                      },
                    }}
                  >
                    <ToggleButton
                      value="exclude"
                      aria-label="Never include"
                      title="Never include (skipped by auto picks)"
                      sx={(t) => ({
                        bgcolor: alpha(t.palette.error.main, 0.06),
                        color: alpha(t.palette.error.light, 0.32),
                        borderColor: alpha(t.palette.error.main, 0.18),
                        "&:not(.Mui-selected):hover": {
                          bgcolor: alpha(t.palette.error.main, 0.12),
                          color: alpha(t.palette.error.light, 0.45),
                        },
                        "&.Mui-selected": {
                          color: t.palette.error.contrastText,
                          bgcolor: t.palette.error.main,
                          borderColor: t.palette.error.main,
                          boxShadow: `inset 0 0 0 1px ${alpha("#fff", 0.28)}`,
                          "&:hover": {
                            bgcolor: t.palette.error.dark,
                            borderColor: t.palette.error.dark,
                          },
                        },
                      })}
                    >
                      <BlockOutlinedIcon sx={{ fontSize: 18 }} />
                    </ToggleButton>
                    <ToggleButton
                      value="neutral"
                      aria-label="Automatic"
                      title="Automatic (newest-first importable rules)"
                      sx={(t) => ({
                        bgcolor: alpha(t.palette.secondary.dark, 0.42),
                        color: alpha(t.palette.text.secondary, 0.55),
                        borderColor: alpha(t.palette.secondary.main, 0.28),
                        "&:not(.Mui-selected):hover": {
                          bgcolor: alpha(t.palette.secondary.dark, 0.55),
                          color: alpha(t.palette.text.secondary, 0.72),
                        },
                        "&.Mui-selected": {
                          color: alpha(t.palette.text.primary, 0.88),
                          bgcolor: alpha(t.palette.secondary.dark, 0.72),
                          borderColor: alpha(t.palette.secondary.light, 0.4),
                          boxShadow: "none",
                          "&:hover": {
                            bgcolor: alpha(t.palette.secondary.dark, 0.82),
                            borderColor: alpha(t.palette.secondary.light, 0.5),
                          },
                        },
                      })}
                    >
                      <RemoveCircleOutlineIcon sx={{ fontSize: 18 }} />
                    </ToggleButton>
                    <ToggleButton
                      value="include"
                      aria-label="Always include"
                      title="Always include (even if older)"
                      sx={(t) => ({
                        bgcolor: alpha(t.palette.success.main, 0.07),
                        color: alpha(t.palette.success.main, 0.35),
                        borderColor: alpha(t.palette.success.main, 0.2),
                        "&:not(.Mui-selected):hover": {
                          bgcolor: alpha(t.palette.success.main, 0.14),
                          color: alpha(t.palette.success.light, 0.5),
                        },
                        "&.Mui-selected": {
                          color: t.palette.success.contrastText,
                          bgcolor: t.palette.success.main,
                          borderColor: t.palette.success.main,
                          boxShadow: `inset 0 0 0 1px ${alpha("#fff", 0.28)}`,
                          "&:hover": {
                            bgcolor: alpha(t.palette.success.main, 0.88),
                            borderColor: alpha(t.palette.success.main, 0.95),
                          },
                        },
                      })}
                    >
                      <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
                    </ToggleButton>
                  </ToggleButtonGroup>
                ) : (
                  <Box sx={{ width: 96, flexShrink: 0 }} aria-hidden />
                );

                const checkbox = (
                  <Tooltip title="Resulting selection after rules and overrides (read-only)">
                    <span>
                      <Checkbox
                        checked={checked}
                        disabled
                        size="small"
                        color={
                          c.alreadyOnCard && checked ? "success" : "primary"
                        }
                        sx={{ p: 0.5 }}
                        inputProps={{
                          "aria-label": `${c.fileName} selected in plan`,
                        }}
                      />
                    </span>
                  </Tooltip>
                );

                const main = (
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{ wordBreak: "break-word" }}
                    >
                      {c.fileName}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      {[
                        c.saveName && c.saveName !== c.fileName
                          ? c.saveName
                          : null,
                        c.parseError || null,
                      ]
                        .filter(Boolean)
                        .join(" — ")}
                    </Typography>
                  </Box>
                );

                const when = (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      whiteSpace: "nowrap",
                      textAlign: "right",
                      pl: 1,
                    }}
                  >
                    {formatFolderRelativeTime(c.mtimeMs)}
                  </Typography>
                );

                return (
                  <Box
                    key={c.path}
                    ref={(el) => {
                      if (el instanceof HTMLElement) {
                        rowElsRef.current.set(c.path, el);
                      } else {
                        rowElsRef.current.delete(c.path);
                      }
                    }}
                    sx={{
                      display: "grid",
                      gridTemplateColumns:
                        "auto auto minmax(0, 1fr) auto",
                      alignItems: "center",
                      columnGap: 1,
                      py: 0.75,
                      borderBottom: 1,
                      borderColor: "divider",
                    }}
                  >
                    {overrideControl}
                    {checkbox}
                    {main}
                    {when}
                  </Box>
                );
              })}
            </FormGroup>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
