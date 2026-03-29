import { createTheme } from '@mui/material/styles'

/**
 * Final Destination in-battle look: obsidian void, indigo base, purple/blue nebula,
 * hot magenta rim light, lavender accents (Fox jacket), star sparkles + grid floor.
 */
const obsidian = '#000000'
const indigoVoid = '#0d0221'
const nebulaPurple = 'rgba(75, 0, 130, 0.42)'
const nebulaBlue = 'rgba(0, 0, 255, 0.18)'
const nebulaViolet = 'rgba(138, 43, 226, 0.15)'

const platformNearBlack = '#0a0a0c'
const platformLift = '#121018'

const hotMagenta = '#ff1493'
const hotMagentaDeep = '#c71585'
const hotMagentaGlow = '#ff00ff'

const lavender = '#b19cd9'
const lavenderDeep = '#8b7aad'
const lavenderMist = '#d4c4f0'

const starWhite = 'rgba(255, 255, 255, 0.55)'
const starBlue = 'rgba(160, 220, 255, 0.65)'

const textPrimary = '#faf8ff'
const textSecondary = '#c8b8e8'

export const ssbmTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: hotMagenta,
      light: '#ff6eb5',
      dark: hotMagentaDeep,
      contrastText: '#0a0206',
    },
    secondary: {
      main: lavender,
      light: lavenderMist,
      dark: lavenderDeep,
      contrastText: '#0f0818',
    },
    background: {
      default: indigoVoid,
      paper: platformNearBlack,
    },
    text: {
      primary: textPrimary,
      secondary: textSecondary,
      disabled: 'rgba(200, 190, 230, 0.35)',
    },
    divider: 'rgba(177, 156, 217, 0.2)',
    success: { main: '#6ee7b3' },
    warning: { main: '#fbbf77' },
    error: { main: '#ff6b8a' },
    info: { main: '#7dd3fc' },
  },
  typography: {
    fontFamily: '"DM Sans", "Roboto", "Helvetica", "Arial", sans-serif',
    htmlFontSize: 17,
    h5: { fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.25 },
    h6: { fontSize: '1.3rem', fontWeight: 600, lineHeight: 1.3 },
    subtitle1: { fontSize: '1.08rem', fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1.4 },
    subtitle2: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: '1.05rem', lineHeight: 1.55 },
    body2: { fontSize: '0.98rem', lineHeight: 1.55 },
    caption: { fontSize: '0.88rem', letterSpacing: '0.04em', lineHeight: 1.45 },
    overline: { fontSize: '0.82rem' },
    button: { fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.06em' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          fontSize: '106.25%',
        },
        body: {
          backgroundColor: obsidian,
          backgroundImage: [
            // Sparkles — white + ice blue
            `radial-gradient(1.5px 1.5px at 7% 14%, ${starWhite}, transparent)`,
            `radial-gradient(1px 1px at 19% 38%, ${starBlue}, transparent)`,
            `radial-gradient(1px 1px at 33% 9%, ${starWhite}, transparent)`,
            `radial-gradient(1.5px 1.5px at 52% 24%, ${starBlue}, transparent)`,
            `radial-gradient(1px 1px at 71% 16%, ${starWhite}, transparent)`,
            `radial-gradient(1px 1px at 86% 36%, ${starBlue}, transparent)`,
            `radial-gradient(1px 1px at 12% 58%, ${starWhite}, transparent)`,
            `radial-gradient(1.5px 1.5px at 44% 72%, ${starBlue}, transparent)`,
            `radial-gradient(1px 1px at 68% 88%, ${starWhite}, transparent)`,
            `radial-gradient(1px 1px at 91% 62%, ${starBlue}, transparent)`,
            // Nebula swirls — deep purple + royal blue
            `radial-gradient(ellipse 65% 45% at 28% 42%, ${nebulaPurple}, transparent 58%)`,
            `radial-gradient(ellipse 55% 40% at 82% 28%, ${nebulaBlue}, transparent 52%)`,
            `radial-gradient(ellipse 50% 55% at 65% 78%, ${nebulaViolet}, transparent 55%)`,
            `radial-gradient(ellipse 40% 35% at 8% 82%, rgba(75, 0, 130, 0.2), transparent 50%)`,
            // Cold void: black into indigo
            `linear-gradient(188deg, ${indigoVoid} 0%, ${obsidian} 42%, #060214 100%)`,
          ].join(', '),
          backgroundAttachment: 'fixed',
          minHeight: '100vh',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          position: 'relative',
          backgroundColor: platformLift,
          backgroundImage: [
            // Subtle stage grid / honeycomb feel
            `linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px)`,
            `linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)`,
            `linear-gradient(165deg, ${platformNearBlack} 0%, ${platformLift} 55%, #0e0c14 100%)`,
          ].join(', '),
          backgroundSize: '20px 20px, 20px 20px, auto',
          border: '1px solid rgba(255, 20, 147, 0.35)',
          boxShadow: `
            0 0 0 1px rgba(177, 156, 217, 0.12) inset,
            0 0 24px rgba(255, 20, 147, 0.12),
            0 0 48px rgba(75, 0, 130, 0.15),
            0 12px 48px rgba(0, 0, 0, 0.85)
          `,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: `linear-gradient(175deg, #ff4db8 0%, ${hotMagenta} 38%, ${hotMagentaDeep} 100%)`,
          color: '#0a0206',
          fontWeight: 700,
          textShadow: `0 0 14px rgba(255, 105, 200, 0.75)`,
          boxShadow: `
            0 0 0 1px rgba(255, 105, 200, 0.65),
            0 0 8px ${hotMagentaGlow},
            0 0 28px rgba(255, 20, 147, 0.55),
            0 4px 20px rgba(0, 0, 0, 0.6)
          `,
          '&:hover': {
            background: `linear-gradient(175deg, #ff7ec8 0%, #ff4db8 45%, ${hotMagenta} 100%)`,
            boxShadow: `
              0 0 0 1px rgba(255, 180, 230, 0.85),
              0 0 12px ${hotMagentaGlow},
              0 0 36px rgba(255, 20, 147, 0.65),
              0 6px 24px rgba(0, 0, 0, 0.55)
            `,
          },
          '&.Mui-disabled': {
            opacity: 1,
            color: '#f0e8ff',
            background: 'linear-gradient(180deg, #4d3d4a 0%, #352830 100%)',
            textShadow: 'none',
            boxShadow: 'inset 0 0 0 1px rgba(177, 156, 217, 0.35)',
          },
        },
        containedSecondary: {
          background: `linear-gradient(180deg, ${lavenderMist} 0%, ${lavender} 42%, ${lavenderDeep} 100%)`,
          color: '#120818',
          fontWeight: 700,
          textShadow: '0 0 10px rgba(255, 255, 255, 0.35)',
          boxShadow: `
            0 0 0 1px rgba(255, 255, 255, 0.25),
            0 0 20px rgba(177, 156, 217, 0.35),
            0 4px 16px rgba(0, 0, 0, 0.5)
          `,
          '&:hover': {
            background: `linear-gradient(180deg, #ece4ff 0%, ${lavenderMist} 50%, ${lavender} 100%)`,
            boxShadow: `
              0 0 0 1px rgba(255, 255, 255, 0.4),
              0 0 28px rgba(177, 156, 217, 0.5)
            `,
          },
        },
        outlined: {
          borderColor: 'rgba(177, 156, 217, 0.45)',
          color: textSecondary,
          backgroundColor: 'rgba(13, 2, 33, 0.45)',
          '&:hover': {
            borderColor: 'rgba(255, 20, 147, 0.65)',
            backgroundColor: 'rgba(255, 20, 147, 0.08)',
            color: textPrimary,
            boxShadow: '0 0 20px rgba(255, 20, 147, 0.15)',
          },
        },
        text: {
          color: textSecondary,
          '&:hover': {
            color: lavenderMist,
            backgroundColor: 'rgba(177, 156, 217, 0.08)',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(177, 156, 217, 0.22)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(177, 156, 217, 0.4)',
          color: textSecondary,
          backgroundColor: 'rgba(13, 2, 33, 0.65)',
          fontFamily: 'inherit',
          '&:hover': {
            borderColor: 'rgba(255, 20, 147, 0.55)',
            backgroundColor: 'rgba(255, 20, 147, 0.1)',
            boxShadow: '0 0 16px rgba(255, 20, 147, 0.2)',
          },
        },
      },
    },
  },
})
