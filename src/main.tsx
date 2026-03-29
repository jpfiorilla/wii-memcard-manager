import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { SnackbarProvider } from 'notistack'
import App from './App'
import { ssbmTheme } from './theme/ssbmTheme'

import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={ssbmTheme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={4} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <App />
      </SnackbarProvider>
    </ThemeProvider>
  </React.StrictMode>,
)

postMessage({ payload: 'removeLoading' }, '*')
