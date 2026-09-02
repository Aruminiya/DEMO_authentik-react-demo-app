import { useState } from 'react'
import type { User } from 'oidc-client-ts'
import {
  Box,
  Button,
  Chip,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'

import { decodeJwt } from '../utils/jwt'

function CodeBlock({ value }: { value: string }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        borderRadius: 1.5,
        bgcolor: 'grey.900',
        color: 'grey.100',
        fontSize: 12.5,
        lineHeight: 1.6,
        overflowX: 'auto',
        maxHeight: 360,
      }}
    >
      {value}
    </Box>
  )
}

function TokenTab({ token, label }: { token?: string | null; label: string }) {
  const claims = decodeJwt(token)

  if (!token) {
    return <Typography color="text.secondary">沒有取得 {label}。</Typography>
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button
          size="small"
          startIcon={<ContentCopyRoundedIcon fontSize="small" />}
          onClick={() => navigator.clipboard.writeText(token)}
        >
          複製原始 Token
        </Button>
      </Stack>

      {claims ? (
        <CodeBlock value={JSON.stringify(claims, null, 2)} />
      ) : (
        <Typography color="text.secondary" variant="body2">
          此 Token 不是可解析的 JWT（可能是 opaque token）。
        </Typography>
      )}
    </Stack>
  )
}

type TokenPanelTab = 'profile' | 'id_token' | 'access_token'

export function TokenPanel({ user }: { user: User | null | undefined }) {
  const [tab, setTab] = useState<TokenPanelTab>('profile')

  return (
    <Box>
      <Tabs value={tab} onChange={(_, value: TokenPanelTab) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="Profile Claims" value="profile" />
        <Tab label="ID Token" value="id_token" />
        <Tab label="Access Token" value="access_token" />
      </Tabs>

      {tab === 'profile' && <CodeBlock value={JSON.stringify(user?.profile ?? {}, null, 2)} />}
      {tab === 'id_token' && <TokenTab token={user?.id_token} label="ID Token" />}
      {tab === 'access_token' && <TokenTab token={user?.access_token} label="Access Token" />}
    </Box>
  )
}

export function ScopeChips({ scope }: { scope?: string | null }) {
  const scopes = (scope || '').split(' ').filter(Boolean)

  if (scopes.length === 0) {
    return null
  }

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
      {scopes.map((s) => (
        <Chip key={s} label={s} size="small" variant="outlined" />
      ))}
    </Stack>
  )
}
