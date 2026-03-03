import { Box, Typography, Alert } from '@mui/material'

interface ActionTaskPageProps {
  isStorageActive: boolean
}

export default function ActionTaskPage({ isStorageActive: _isStorageActive }: ActionTaskPageProps) {
  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="info">
        이 페이지는 더이상 사용되지 않습니다. Task 관리는 태스크 탭에서 모든 카테고리를 관리합니다.
      </Alert>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        상단의 "파이프라인 설정" 버튼을 클릭한 후 "태스크" 탭에서 모든 카테고리(문자열 필터, 페이지 이동, 링크 추출, 리소스 추출)의 태스크를 관리하세요.
      </Typography>
    </Box>
  )
}
