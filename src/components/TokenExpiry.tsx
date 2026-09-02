import { useEffect, useState } from 'react'
import { Chip } from '@mui/material'

export function TokenExpiry({ expiresAt }: { expiresAt?: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  if (!expiresAt) {
    return <Chip size="small" label="無到期時間資訊" variant="outlined" />
  }

  const remaining = expiresAt - now

  if (remaining <= 0) {
    return <Chip size="small" color="error" label="Access Token 已過期" />
  }

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <Chip
      size="small"
      color={remaining < 60 ? 'warning' : 'success'}
      label={`Access Token 於 ${minutes}分${String(seconds).padStart(2, '0')}秒後到期`}
    />
  )
}
