import type { ReactNode } from 'react'
import { useAuth } from 'react-oidc-context'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'

import { AppHeader } from '../components/AppHeader'
import { TokenExpiry } from '../components/TokenExpiry'
import { ScopeChips, TokenPanel } from '../components/TokenPanel'
import { getPortalProducts } from '../utils/portalProducts'

const DEMO_GROUP = 'authentik-react-demo-member'

// Portal 模式專用：把「產品細節」類卡片（個人資料／群組權限／Token）改成預設收合的
// Accordion，讓「其他產品」那個 launcher 區塊當畫面的主角，不用跟一堆技術細節搶注意力。
// Product 模式完全不會用到這個元件，卡片維持原本攤開的樣子。
function CollapsibleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Accordion
      disableGutters
      elevation={1}
      sx={{ borderRadius: 2, overflow: 'hidden', '&::before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: { xs: 3, sm: 4 } }}>
        <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 3, sm: 4 }, pb: { xs: 3, sm: 4 }, pt: 0 }}>{children}</AccordionDetails>
    </Accordion>
  )
}

export default function DashboardPage() {
  const auth = useAuth()
  const profile = auth.user?.profile
  const groupsClaim = profile?.groups
  const groups = Array.isArray(groupsClaim)
    ? groupsClaim.filter((g): g is string => typeof g === 'string')
    : null
  const isInDemoGroup = groups?.includes(DEMO_GROUP) ?? false

  const isPortal = import.meta.env.VITE_DEMO_APP_TYPE === 'portal'
  const portalProducts = isPortal ? getPortalProducts() : []

  const profileSection = (
    <>
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
    </>
  )

  const groupsSection = (
    <>
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
    </>
  )

  const tokenSection = <TokenPanel user={auth.user} />

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppHeader />

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={3}>
          {isPortal && (
            <Card
              sx={{
                border: '1px solid',
                borderColor: 'primary.main',
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.main}1a, transparent 60%)`,
              }}
            >
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <RocketLaunchRoundedIcon color="primary" fontSize="large" />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    其他產品
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  這幾個產品串接的是同一個 Authentik——點下去是整頁導頁到該產品自己的網址，
                  不是嵌入畫面。因為共用同一個登入 session，理論上不用重新輸入密碼。
                </Typography>

                {portalProducts.length === 0 ? (
                  <Alert severity="info" variant="outlined">
                    目前沒有設定任何產品。請在 <code>VITE_PORTAL_PRODUCTS</code> 填入逗號分隔的網址，
                    例如 <code>{'http://localhost:5175,http://localhost:5176'}</code>，
                    每個產品的顯示名稱會直接取網址的 host（例如 <code>localhost:5175</code>）。
                  </Alert>
                ) : (
                  <Stack spacing={1.5}>
                    {portalProducts.map((product) => (
                      <Link
                        key={product.url}
                        href={product.url}
                        underline="hover"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          color: 'text.primary',
                          fontWeight: 600,
                          fontSize: '1.05rem',
                        }}
                      >
                        {product.name}
                        <ChevronRightRoundedIcon color="action" />
                      </Link>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}

          {auth.error && <Alert severity="error">{auth.error.message}</Alert>}

          {isPortal ? (
            <CollapsibleSection title="個人資料">{profileSection}</CollapsibleSection>
          ) : (
            <Card>
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>{profileSection}</CardContent>
            </Card>
          )}

          {isPortal ? (
            <CollapsibleSection title="群組與權限">{groupsSection}</CollapsibleSection>
          ) : (
            <Card>
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                  群組與權限
                </Typography>
                {groupsSection}
              </CardContent>
            </Card>
          )}

          {isPortal ? (
            <CollapsibleSection title="Token 詳細內容">{tokenSection}</CollapsibleSection>
          ) : (
            <Card>
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Token 詳細內容
                </Typography>
                {tokenSection}
              </CardContent>
            </Card>
          )}
        </Stack>
      </Container>
    </Box>
  )
}
