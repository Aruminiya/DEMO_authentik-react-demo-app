import { Box, CircularProgress, Stack, Typography } from '@mui/material'

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
