/**
 * VSCode 스타일 커스텀 타이틀바
 */

import { useState, useEffect } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import MinimizeIcon from '@mui/icons-material/Remove'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import FilterNoneIcon from '@mui/icons-material/FilterNone'
import CloseIcon from '@mui/icons-material/Close'

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.windowControl.isMaximized().then(setIsMaximized)
    window.windowControl.onMaximizedChange(setIsMaximized)
  }, [])

  const btnSx = {
    borderRadius: 0,
    width: 46,
    height: '100%',
    color: 'grey.400',
    '&:hover': { bgcolor: 'action.hover' },
    '& svg': { fontSize: 16 }
  }

  return (
    <Box sx={{
      height: 32,
      display: 'flex',
      alignItems: 'center',
      bgcolor: 'background.default',
      borderBottom: '1px solid',
      borderColor: 'divider',
      WebkitAppRegion: 'drag',
      userSelect: 'none',
      flexShrink: 0,
      zIndex: 9999,
    }}>
      {/* 앱 아이콘 + 이름 */}
      <Typography sx={{
        fontSize: '12px',
        color: 'grey.500',
        pl: 1.5,
        fontWeight: 500,
        letterSpacing: 0.3,
      }}>
        SiteCrawl
      </Typography>

      {/* 드래그 영역 (중앙) */}
      <Box sx={{ flex: 1 }} />

      {/* 창 제어 버튼 */}
      <Box sx={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' }}>
        <IconButton
          size="small"
          onClick={() => window.windowControl.minimize()}
          sx={btnSx}
          disableRipple
        >
          <MinimizeIcon />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => window.windowControl.maximize()}
          sx={btnSx}
          disableRipple
        >
          {isMaximized ? <FilterNoneIcon /> : <CropSquareIcon />}
        </IconButton>
        <IconButton
          size="small"
          onClick={() => window.windowControl.close()}
          sx={{
            ...btnSx,
            '&:hover': { bgcolor: 'error.main', color: 'white' }
          }}
          disableRipple
        >
          <CloseIcon />
        </IconButton>
      </Box>
    </Box>
  )
}
