import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Container, Stack, Typography } from '@mui/material'

export default function NotFoundPage() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 3 }}>
      <Container maxWidth="xs">
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 700 }}>404</Typography>
          <Typography color="text.secondary">找不到這個頁面。</Typography>
          <Button component={RouterLink} to="/" variant="contained">
            回首頁
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
