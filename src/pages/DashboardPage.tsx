import { useAuth } from 'react-oidc-context'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'

import { AppHeader } from '../components/AppHeader'
import { TokenExpiry } from '../components/TokenExpiry'
import { ScopeChips, TokenPanel } from '../components/TokenPanel'

export default function DashboardPage() {
  const auth = useAuth()
  const profile = auth.user?.profile

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppHeader />

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Card>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: { sm: 'center' } }}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: 24 }}>
                  {(profile?.email || profile?.preferred_username || '?').charAt(0).toUpperCase()}
                </Avatar>

                <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {profile?.name || profile?.preferred_username || '已登入使用者'}
                  </Typography>
                  <Typography color="text.secondary">{profile?.email}</Typography>
                </Stack>

                <Stack spacing={1} sx={{ alignItems: { xs: 'flex-start', sm: 'flex-end' } }}>
                  <TokenExpiry expiresAt={auth.user?.expires_at} />
                  <Button
                    size="small"
                    startIcon={<RefreshRoundedIcon fontSize="small" />}
                    onClick={() => void auth.signinSilent()}
                  >
                    手動更新 Token
                  </Button>
                </Stack>
              </Stack>

              <Divider sx={{ my: 3 }} />

              <Stack spacing={1.5}>
                <Typography variant="subtitle2" color="text.secondary">
                  已授權的 Scope
                </Typography>
                <ScopeChips scope={auth.user?.scope} />
              </Stack>
            </CardContent>
          </Card>

          {auth.error && <Alert severity="error">{auth.error.message}</Alert>}

          <Card>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Token 詳細內容
              </Typography>
              <TokenPanel user={auth.user} />
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}
