import { useAuth } from 'react-oidc-context'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import HubRoundedIcon from '@mui/icons-material/HubRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'

import { postLogoutRedirectUri } from '../config/oidc'
import { getEnv } from '../config/runtimeEnv'
import { signoutWithCancelBounce } from '../utils/authentikLogout'

export function AppHeader() {
  const auth = useAuth()

  const isPortal = getEnv('VITE_DEMO_APP_TYPE') === 'portal'
  const appName = getEnv('VITE_DEMO_APP_NAME') || 'React + Authentik OIDC Demo'
  const initials = (auth.user?.profile?.email || auth.user?.profile?.preferred_username || '?')
    .charAt(0)
    .toUpperCase()

  return (
    <AppBar
      position="static"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: '1px solid',
        borderColor: isPortal ? 'primary.main' : 'divider',
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', flexGrow: 1 }}>
          {isPortal && <HubRoundedIcon color="primary" />}
          <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
            {appName}
          </Typography>
          {isPortal && (
            <Chip
              label="Portal"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600, display: { xs: 'none', sm: 'inline-flex' } }}
            />
          )}
        </Stack>

        {auth.isAuthenticated && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
              {initials}
            </Avatar>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {auth.user?.profile?.email}
            </Typography>
            <Tooltip title="只登出這個應用程式；Authentik 帳號本身仍保持登入，其他串接同一個 Authentik 的應用不受影響">
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<LogoutRoundedIcon />}
                onClick={async () => {
                  // 這裡故意不用 auth.signoutRedirect()——原因見
                  // signoutWithCancelBounce()（繞過 Authentik 登出白畫面的 bug）。
                  const idTokenHint = auth.user?.id_token
                  await auth.removeUser()
                  await signoutWithCancelBounce(idTokenHint, postLogoutRedirectUri)
                }}
              >
                登出此應用
              </Button>
            </Tooltip>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  )
}
