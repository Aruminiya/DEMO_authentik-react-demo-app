import { useAuth } from 'react-oidc-context'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'

import { AppHeader } from '../components/AppHeader'
import { TokenExpiry } from '../components/TokenExpiry'
import { ScopeChips, TokenPanel } from '../components/TokenPanel'

const DEMO_GROUP = 'engineering'

export default function DashboardPage() {
  const auth = useAuth()
  const profile = auth.user?.profile
  const groupsClaim = profile?.groups
  const groups = Array.isArray(groupsClaim)
    ? groupsClaim.filter((g): g is string => typeof g === 'string')
    : null
  const isInDemoGroup = groups?.includes(DEMO_GROUP) ?? false

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
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                群組與權限
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                這是 Authentik 除了「證明你是誰」之外，另外決定「你能用什麼」的資料——由 Token 裡的 <code>groups</code> claim 帶過來。
              </Typography>

              {groups === null ? (
                <Alert severity="info" variant="outlined">
                  目前的 Token 裡沒有 <code>groups</code> claim。要讓 Authentik 把使用者的群組也放進 Token，
                  需要在 Authentik 後台幫這個 Provider 加一個包含 <code>groups</code> 的 Scope Mapping，
                  並把該 scope 加進 <code>VITE_AUTHENTIK_SCOPE</code>。
                </Alert>
              ) : groups.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  這個帳號目前沒有加入任何群組。
                </Typography>
              ) : (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {groups.map((g) => (
                    <Chip key={g} label={g} size="small" color="primary" variant="outlined" />
                  ))}
                </Stack>
              )}

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                權限示範：僅 {DEMO_GROUP} 群組可見的區塊
              </Typography>
              {isInDemoGroup ? (
                <Alert icon={<CheckCircleRoundedIcon fontSize="inherit" />} severity="success" variant="outlined">
                  你屬於 <strong>{DEMO_GROUP}</strong> 群組，所以看得到這個區塊——這就是「決定他能用哪些系統」在畫面上實際的樣子。
                </Alert>
              ) : (
                <Alert icon={<LockRoundedIcon fontSize="inherit" />} severity="warning" variant="outlined">
                  這個區塊只有 <strong>{DEMO_GROUP}</strong> 群組能看到，目前這個帳號不在名單內，所以畫面上不會出現內容。
                </Alert>
              )}
            </CardContent>
          </Card>

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
