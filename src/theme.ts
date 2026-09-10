import { createTheme } from '@mui/material/styles'

const THEME_COLORS: Record<string, string> = {
  default: '#fd4b2d',
  blue: '#1976d2',
  green: '#2e7d32',
  yellow: '#f9a825',
  purple: '#6a1b9a',
  pink: '#c2185b',
  orange: '#ef6c00',
  cyan: '#0097a7',
  indigo: '#303f9f',
}

const themeColor = import.meta.env.VITE_THEME_COLOR ?? 'default'
const primaryColor = THEME_COLORS[themeColor] ?? THEME_COLORS.default

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: primaryColor,
    },
    background: {
      default: '#f5f6f8',
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
})
