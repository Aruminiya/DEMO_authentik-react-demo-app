import { Typography } from '@mui/material'

// 固定在畫面右下角的版本號，用來一眼確認部署上去的是不是新版
// （對照 scripts/push.sh 推的 :<version> tag）。不攔截點擊，免得蓋住底下的按鈕。
export function AppVersion() {
  return (
    <Typography
      variant="caption"
      color="textDisabled"
      sx={{ position: 'fixed', right: 12, bottom: 8, pointerEvents: 'none', userSelect: 'none' }}
    >
      v{__APP_VERSION__}
    </Typography>
  )
}
