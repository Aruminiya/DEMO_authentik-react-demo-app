import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import SwitchAccountRoundedIcon from '@mui/icons-material/SwitchAccountRounded'

import { clearLastUser, getLastUser } from '../utils/lastUser'

type LocationState = {
  from?: { pathname: string }
}

export default function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const [lastUser, setLastUser] = useState(() => getLastUser())

  const state = location.state as LocationState | null
  const from = state?.from?.pathname || '/dashboard'

  if (auth.isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const lastUserLabel = lastUser?.name || lastUser?.email
  const lastUserInitial = (lastUser?.name || lastUser?.email || '?').charAt(0).toUpperCase()
  const enrollmentUrl = import.meta.env.VITE_AUTHENTIK_ENROLLMENT_URL
  const enrollmentHref = enrollmentUrl
    ? `${enrollmentUrl}${enrollmentUrl.includes('?') ? '&' : '?'}next=${encodeURIComponent(`${window.location.origin}/login`)}`
    : undefined

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        py: 4,
        px: 2,
      }}
    >
      <Container maxWidth="sm">
        <Card sx={{ boxShadow: '0 18px 45px rgba(15, 23, 42, 0.10)' }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={3}>
              <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
                <ShieldRoundedIcon color="primary" sx={{ fontSize: 48 }} />
                <Typography component="h1" variant="h5" sx={{ fontWeight: 600 }}>
                  React + Authentik OIDC Demo
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  使用你的 Authentik 帳號登入，體驗完整的 OIDC 登入流程。
                </Typography>
              </Stack>

              {auth.error && (
                <Alert severity="error">登入時發生錯誤：{auth.error.message}</Alert>
              )}

              {lastUserLabel ? (
                <Stack spacing={2}>
                  <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      歡迎回來！
                    </Typography>
                    <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
                      {lastUserInitial}
                    </Avatar>
                    <Typography variant="body2" color="text.secondary">
                      {lastUserLabel}
                    </Typography>
                  </Stack>

                  <Button
                    type="button"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={auth.isLoading}
                    startIcon={auth.isLoading ? <CircularProgress size={20} color="inherit" /> : null}
                    onClick={() => void auth.signinRedirect()}
                  >
                    {auth.isLoading ? '導向登入中…' : '繼續'}
                  </Button>

                  <Divider>或</Divider>

                  <Button
                    type="button"
                    variant="outlined"
                    size="large"
                    fullWidth
                    color="inherit"
                    disabled={auth.isLoading}
                    startIcon={<SwitchAccountRoundedIcon />}
                    onClick={() => void auth.signinRedirect({ prompt: 'login' })}
                  >
                    使用其他帳號繼續操作
                  </Button>

                  <Link
                    component="button"
                    type="button"
                    variant="caption"
                    color="text.secondary"
                    underline="hover"
                    sx={{ alignSelf: 'center' }}
                    onClick={() => {
                      clearLastUser()
                      setLastUser(null)
                    }}
                  >
                    不是你？移除已記住的帳號
                  </Link>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Button
                    type="button"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={auth.isLoading}
                    startIcon={auth.isLoading ? <CircularProgress size={20} color="inherit" /> : null}
                    onClick={() => void auth.signinRedirect()}
                  >
                    {auth.isLoading ? '導向登入中…' : '使用 Authentik 登入'}
                  </Button>

                  <Button
                    type="button"
                    variant="text"
                    size="small"
                    fullWidth
                    color="inherit"
                    disabled={auth.isLoading}
                    startIcon={<SwitchAccountRoundedIcon fontSize="small" />}
                    onClick={() => void auth.signinRedirect({ prompt: 'login' })}
                  >
                    使用其他帳號登入
                  </Button>
                </Stack>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                登入後會導向 Authentik 的授權頁面，完成後自動導回本站。
              </Typography>

              {enrollmentUrl && !lastUserLabel && (
                <Stack spacing={0.5}>
                  <Typography variant="body2" sx={{ textAlign: 'center' }}>
                    還沒有帳號？{' '}
                    <Link href={enrollmentHref} underline="hover">
                      前往註冊
                    </Link>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                    註冊完成後，請返回這個頁面並點擊上方按鈕登入。
                  </Typography>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
