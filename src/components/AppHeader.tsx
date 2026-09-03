import { useAuth } from 'react-oidc-context'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'

import { postLogoutRedirectUri } from '../config/oidc'

export function AppHeader() {
  const auth = useAuth()

  const initials = (auth.user?.profile?.email || auth.user?.profile?.preferred_username || '?')
    .charAt(0)
    .toUpperCase()

  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
          React + Authentik Demo
        </Typography>

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
                onClick={() =>
                  auth.signoutRedirect({
                    post_logout_redirect_uri: postLogoutRedirectUri,
                  })
                }
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
