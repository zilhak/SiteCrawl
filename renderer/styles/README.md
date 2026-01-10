# Styles Directory

테마 및 색상 정의를 중앙화하여 관리합니다.

## 📁 구조

```
styles/
├── colors.ts      # 색상 팔레트 정의
├── theme.ts       # MUI 테마 설정
├── index.ts       # Export aggregation
└── README.md      # 이 파일
```

---

## 🎨 사용법

### 1. 테마 사용 (기본)

```tsx
import { ThemeProvider } from '@mui/material'
import { theme } from './styles'

function App() {
  return (
    <ThemeProvider theme={theme}>
      {/* 앱 컴포넌트 */}
    </ThemeProvider>
  )
}
```

### 2. 색상 직접 사용

```tsx
import { colors } from './styles'

function MyComponent() {
  return (
    <Box sx={{
      bgcolor: colors.background.paper,
      color: colors.text.primary,
      borderColor: colors.divider
    }}>
      커스텀 배경 색상
    </Box>
  )
}
```

### 3. 테마 색상 사용 (권장)

```tsx
function MyComponent() {
  return (
    <Box sx={{
      bgcolor: 'background.paper',     // 테마에서 자동 적용
      color: 'text.primary',
      borderColor: 'divider'
    }}>
      테마 색상 사용
    </Box>
  )
}
```

---

## 🔧 색상 커스터마이징

### colors.ts 수정

```typescript
export const colors = {
  primary: {
    main: '#YOUR_COLOR',  // 원하는 색상으로 변경
  },
  background: {
    default: '#0a0e27',   // 전체 배경색
    paper: '#151a2e',     // 카드 배경색
  },
}
```

### 새로운 색상 추가

```typescript
export const colors = {
  // 기존 색상...

  // 커스텀 색상 추가
  custom: {
    highlight: '#ff6b9d',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
} as const
```

사용:
```tsx
<Box sx={{ bgcolor: colors.custom.highlight }}>
  하이라이트 배경
</Box>
```

---

## 📝 색상 가이드

### Background (배경)
- `background.default` - 메인 배경 (#0a0e27)
- `background.paper` - 카드/패널 (#151a2e)
- `background.elevated` - 호버/선택 (#1e2538)

### Text (텍스트)
- `text.primary` - 주요 텍스트 (#e4e6eb)
- `text.secondary` - 보조 텍스트 (#b0b3b8)
- `text.disabled` - 비활성 텍스트 (#6b6f76)

### Accent (강조)
- `accent.success` - 성공 (#10b981)
- `accent.warning` - 경고 (#f59e0b)
- `accent.error` - 에러 (#ef4444)
- `accent.info` - 정보 (#3b82f6)

---

## ⚡ 베스트 프랙티스

### ✅ 권장
```tsx
// 테마 색상 사용
<Box sx={{ bgcolor: 'background.paper' }}>

// 일관된 색상 import
import { colors, theme } from './styles'
```

### ❌ 비권장
```tsx
// 하드코딩된 색상
<Box sx={{ bgcolor: '#151a2e' }}>

// 개별 import
import { colors } from './styles/colors'
import { theme } from './styles/theme'
```

---

## 🔄 마이그레이션 가이드

기존 하드코딩 색상을 찾아서 변경:

**Before:**
```tsx
<Paper sx={{ bgcolor: 'grey.50' }}>
```

**After:**
```tsx
<Paper sx={{ bgcolor: 'background.paper' }}>
```

**Before:**
```tsx
<Box sx={{ color: '#ffffff' }}>
```

**After:**
```tsx
<Box sx={{ color: 'text.primary' }}>
```
