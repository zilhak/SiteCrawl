# Renderer Code Guidelines

React/TypeScript 프론트엔드 코드 작성 규칙입니다.

---

## 🎨 스타일 & 색상 규칙

### ❌ 절대 금지사항

#### 1. 컴포넌트/페이지에 하드코딩된 색상 값

```tsx
// ❌ 금지 - 하드코딩된 HEX 색상
<Box sx={{ bgcolor: '#151a2e' }}>

// ❌ 금지 - 하드코딩된 RGB 색상
<Box sx={{ color: 'rgb(255, 255, 255)' }}>

// ❌ 금지 - 하드코딩된 RGBA 색상
<Box sx={{ borderColor: 'rgba(255, 255, 255, 0.12)' }}>

// ❌ 금지 - 인라인 스타일에 하드코딩
<div style={{ backgroundColor: '#0a0e27' }}>

// ❌ 금지 - CSS-in-JS에 하드코딩
const StyledBox = styled(Box)`
  background-color: #151a2e;
`
```

### ✅ 올바른 방법

#### 방법 1: 테마 색상 사용 (권장)

```tsx
import { Box } from '@mui/material'

// ✅ 올바름 - MUI 테마 색상
<Box sx={{
  bgcolor: 'background.paper',
  color: 'text.primary',
  borderColor: 'divider'
}}>

// ✅ 올바름 - 테마 팔레트
<Button sx={{
  bgcolor: 'primary.main',
  '&:hover': { bgcolor: 'primary.dark' }
}}>
```

#### 방법 2: styles에서 직접 import

```tsx
import { colors } from './styles'

// ✅ 올바름 - 색상 변수 사용
<Box sx={{
  bgcolor: colors.background.paper,
  color: colors.text.primary
}}>

// ✅ 올바름 - 커스텀 색상 사용
<Box sx={{
  bgcolor: colors.accent.success,
  borderColor: colors.divider
}}>
```

#### 방법 3: CSS Variables (선택적)

```tsx
// styles/colors.ts에 CSS 변수 정의
export const cssVars = {
  '--color-bg-default': colors.background.default,
  '--color-bg-paper': colors.background.paper,
}

// 사용
<Box sx={{ bgcolor: 'var(--color-bg-paper)' }}>
```

---

## 📁 파일 구조 규칙

### 디렉토리 구조

```
renderer/
├── components/          # 재사용 가능한 컴포넌트
│   ├── ui/             # 기본 UI 컴포넌트
│   ├── crawler/        # 크롤러 관련 컴포넌트
│   ├── pipeline/       # 파이프라인 관련 컴포넌트
│   └── tasks/          # 태스크 관련 컴포넌트
├── pages/              # 페이지 컴포넌트
├── services/           # IPC 서비스 레이어
├── styles/             # 테마 및 색상 정의 (중앙 관리)
│   ├── colors.ts       # 색상 팔레트 (모든 색상은 여기만!)
│   ├── theme.ts        # MUI 테마 설정
│   └── index.ts        # Export
├── types.d.ts          # TypeScript 타입 정의
├── App.tsx             # 루트 컴포넌트
└── main.tsx            # Entry point
```

### 파일 명명 규칙

```
✅ PascalCase: 컴포넌트 파일
   - CrawlingPage.tsx
   - TaskCard.tsx

✅ camelCase: 유틸/서비스 파일
   - crawlerService.ts
   - storageService.ts

✅ kebab-case: 스타일 파일 (선택적)
   - custom-styles.css
```

---

## 🔒 필수 규칙 체크리스트

### 스타일 관련

- [ ] **모든 색상 값은 `styles/colors.ts`에만 정의**
- [ ] **컴포넌트/페이지에 HEX, RGB, RGBA 하드코딩 금지**
- [ ] **새로운 색상 필요시 `colors.ts`에 먼저 추가**
- [ ] **테마 색상 사용 우선 (`bgcolor: 'background.paper'`)**
- [ ] **불가피한 경우에만 `colors` import 사용**

### TypeScript 관련

- [ ] **`any` 타입 사용 금지 (`unknown` 사용)**
- [ ] **모든 Props에 interface/type 정의**
- [ ] **IPC 통신 타입 명시 (`types.d.ts`)**
- [ ] **strict mode 준수**

### 컴포넌트 관련

- [ ] **한 파일에 하나의 export default 컴포넌트**
- [ ] **재사용 가능한 컴포넌트는 `components/` 폴더**
- [ ] **페이지 단위 컴포넌트는 `pages/` 폴더**
- [ ] **비즈니스 로직은 별도 분리 (hooks/utils)**

---

## 🎯 색상 변경 워크플로우

### 새 색상 추가 시

**Step 1:** `styles/colors.ts`에 색상 추가
```typescript
export const colors = {
  // ... 기존 색상

  custom: {
    newColor: '#ff6b9d',
    newGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  }
} as const
```

**Step 2:** 필요시 테마에 등록 (`styles/theme.ts`)
```typescript
export const theme = createTheme({
  palette: {
    // ... 기존 설정

    customColor: {
      main: colors.custom.newColor,
    }
  }
})
```

**Step 3:** 컴포넌트에서 사용
```tsx
// 방법 A: 테마 사용
<Box sx={{ bgcolor: 'customColor.main' }}>

// 방법 B: 직접 사용
import { colors } from './styles'
<Box sx={{ bgcolor: colors.custom.newColor }}>
```

---

## 🔍 코드 리뷰 체크포인트

### Pull Request 전 확인사항

```bash
# 1. 하드코딩된 색상 검색
grep -r "#[0-9a-fA-F]\{6\}" renderer/components renderer/pages

# 2. RGB/RGBA 패턴 검색
grep -r "rgb\|rgba" renderer/components renderer/pages

# 3. TypeScript 타입 체크
npm run typecheck

# 4. ESLint 검사
npm run lint
```

### 자동 검증 예시

하드코딩된 색상이 발견되면 **PR 거부**:

```tsx
// ❌ 이런 코드가 발견되면 수정 요청
<Box sx={{ bgcolor: '#151a2e' }}>
<div style={{ color: 'rgb(255, 255, 255)' }}>
```

---

## 📚 참고 문서

### 내부 문서
- [스타일 가이드](./styles/README.md) - 색상 팔레트 및 사용법
- [타입 정의](./types.d.ts) - 전역 타입 정의

### 외부 문서
- [MUI Theming](https://mui.com/material-ui/customization/theming/)
- [MUI sx prop](https://mui.com/system/getting-started/the-sx-prop/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

---

## ⚠️ 위반 시 처리

### 경고 단계
1. **1차 위반**: 코드 리뷰 코멘트 + 수정 요청
2. **2차 위반**: PR 거부 + 가이드 재숙지
3. **3차 위반**: 팀 논의

### 자주 하는 실수

#### 실수 1: MUI 기본 색상 사용
```tsx
// ❌ MUI 기본 grey 팔레트 사용
<Box sx={{ bgcolor: 'grey.50' }}>
<Paper sx={{ bgcolor: 'grey.100' }}>

// ✅ 커스텀 테마 색상 사용
<Box sx={{ bgcolor: 'background.paper' }}>
<Paper sx={{ bgcolor: 'background.elevated' }}>
```

#### 실수 2: 투명도를 위한 하드코딩
```tsx
// ❌ 하드코딩된 RGBA
<Box sx={{ borderColor: 'rgba(255, 255, 255, 0.12)' }}>

// ✅ colors.ts에 정의
// colors.ts
export const colors = {
  divider: 'rgba(255, 255, 255, 0.12)',
}

// 사용
<Box sx={{ borderColor: 'divider' }}>
```

#### 실수 3: 조건부 색상 하드코딩
```tsx
// ❌ 조건부 하드코딩
<Box sx={{
  bgcolor: isActive ? '#667eea' : '#6b6f76'
}}>

// ✅ 테마 색상 사용
<Box sx={{
  bgcolor: isActive ? 'primary.main' : 'text.disabled'
}}>

// ✅ colors 사용
import { colors } from './styles'
<Box sx={{
  bgcolor: isActive ? colors.primary.main : colors.text.disabled
}}>
```

---

## 🛠️ 도구 및 자동화

### ESLint 규칙 추가 (권장)

```json
// .eslintrc.json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Literal[value=/#[0-9a-fA-F]{6}/]",
        "message": "하드코딩된 HEX 색상 금지. styles/colors.ts를 사용하세요."
      }
    ]
  }
}
```

### Pre-commit Hook (권장)

```bash
# .husky/pre-commit
#!/bin/sh

echo "🔍 하드코딩된 색상 검사 중..."

# HEX 색상 검사
if git diff --cached --name-only | grep -E "renderer/(components|pages)" | xargs grep -E "#[0-9a-fA-F]{6}"; then
  echo "❌ 하드코딩된 색상이 발견되었습니다!"
  echo "styles/colors.ts를 사용하세요."
  exit 1
fi

echo "✅ 색상 규칙 통과"
```

---

## 📝 예제 코드

### 올바른 컴포넌트 작성 예시

```tsx
// ✅ Good Example
import { Box, Typography } from '@mui/material'
import { colors } from '../styles'

interface MyComponentProps {
  isActive: boolean
}

export default function MyComponent({ isActive }: MyComponentProps) {
  return (
    <Box sx={{
      // 테마 색상 사용
      bgcolor: 'background.paper',
      color: 'text.primary',
      borderColor: 'divider',

      // 조건부 색상 (테마)
      ...(isActive && {
        bgcolor: 'primary.main',
      }),

      // 호버 효과
      '&:hover': {
        bgcolor: 'background.elevated',
      },
    }}>
      <Typography color="text.secondary">
        컨텐츠
      </Typography>
    </Box>
  )
}
```

### 커스텀 색상 사용 예시

```tsx
// ✅ Good Example - 특수한 색상이 필요한 경우
import { Box } from '@mui/material'
import { colors } from '../styles'

export default function SpecialComponent() {
  return (
    <Box sx={{
      // styles에 정의된 커스텀 색상 사용
      background: colors.custom.gradient,
      borderColor: colors.custom.highlight,
    }}>
      특별한 스타일링
    </Box>
  )
}
```

---

## 🚀 마이그레이션 가이드

### 기존 코드를 규칙에 맞게 수정하기

**Before (잘못된 코드):**
```tsx
export default function OldComponent() {
  return (
    <Box sx={{
      bgcolor: '#151a2e',           // ❌ 하드코딩
      color: 'white',               // ❌ 하드코딩
      border: '1px solid rgba(255, 255, 255, 0.12)' // ❌ 하드코딩
    }}>
      <Paper sx={{ bgcolor: 'grey.50' }}>  {/* ❌ MUI 기본 색상 */}
        Content
      </Paper>
    </Box>
  )
}
```

**After (올바른 코드):**
```tsx
export default function NewComponent() {
  return (
    <Box sx={{
      bgcolor: 'background.paper',    // ✅ 테마 색상
      color: 'text.primary',          // ✅ 테마 색상
      borderColor: 'divider'          // ✅ 테마 색상
    }}>
      <Paper sx={{ bgcolor: 'background.default' }}>  {/* ✅ 테마 색상 */}
        Content
      </Paper>
    </Box>
  )
}
```

---

## 💡 FAQ

### Q: 왜 하드코딩을 금지하나요?
A:
1. **일관성**: 전체 앱의 색상 일관성 유지
2. **유지보수**: 한 곳만 수정하면 전체 반영
3. **테마 전환**: 다크/라이트 모드 쉽게 전환 가능
4. **가독성**: 의미있는 이름으로 코드 가독성 향상

### Q: 정말 급한데 한 번만 하드코딩 안될까요?
A: ❌ **안됩니다.**
- "한 번만" → "계속" 이어지는 악순환
- 30초만 투자해서 `colors.ts`에 추가하세요
- 미래의 당신이 감사할 겁니다

### Q: 외부 라이브러리 색상은 어떻게 하나요?
A:
```tsx
// ✅ 라이브러리 props에 테마 색상 전달
import { colors } from './styles'

<ExternalComponent
  primaryColor={colors.primary.main}
  backgroundColor={colors.background.paper}
/>
```

### Q: 디자이너가 준 색상은 바로 써도 되나요?
A: ❌ **안됩니다.**
1. 먼저 `colors.ts`에 추가
2. 의미있는 이름 부여
3. 그 다음 사용

---

**마지막 업데이트**: 2026-01-03
**작성자**: Development Team
**문의**: 팀 리드 또는 Slack #frontend 채널
