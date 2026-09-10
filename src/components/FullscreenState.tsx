import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'

type FullscreenLoaderProps = {
  label?: string
}

export function FullscreenLoader({ label }: FullscreenLoaderProps) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <CircularProgress />
        {label && <Typography color="text.secondary">{label}</Typography>}
      </Stack>
    </Box>
  )
}

type FullscreenErrorProps = {
  message: string
  onRetry: () => void
}

export function FullscreenError({ message, onRetry }: FullscreenErrorProps) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <Stack spacing={2} sx={{ alignItems: 'center', maxWidth: 420, textAlign: 'center' }}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {message}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          自動導向 Authentik 登入時發生錯誤，可以重試，或回登入頁手動操作。
        </Typography>
        <Stack direction="row" spacing={1.5}>
          <Button variant="contained" onClick={onRetry}>
            重試
          </Button>
          <Button component={RouterLink} to="/login" variant="outlined">
            回登入頁
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
