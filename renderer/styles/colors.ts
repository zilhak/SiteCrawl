/**
 * Color Palette
 *
 * 규칙:
 * - 배경/텍스트/테두리: 순수 회색·검정·흰색만 사용
 * - 악센트: ColorHunt 팔레트 (#0B2D72 #0992C2 #0AC4E0 #F6E7BC) + 보조색
 *
 * @see https://colorhunt.co/palette/0b2d720992c20ac4e0f6e7bc
 */
export const colors = {
  // ── ColorHunt Palette ──────────────────────────
  // Primary: 시안 블루 계열
  primary: {
    main: '#0992C2',
    light: '#0AC4E0',
    dark: '#0B2D72',
    contrastText: '#ffffff',
  },

  // Secondary: 딥 네이비
  secondary: {
    main: '#0B2D72',
    light: '#0992C2',
    dark: '#061B45',
    contrastText: '#ffffff',
  },

  // ── Background (순수 회색/검정) ────────────────
  background: {
    default: '#111111',       // 메인 배경
    paper: '#1a1a1a',         // 카드/패널 배경
    elevated: '#252525',      // 호버/선택 배경
  },

  // ── Text (순수 회색/흰색) ──────────────────────
  text: {
    primary: '#e8e8e8',       // 주요 텍스트
    secondary: '#a0a0a0',     // 보조 텍스트
    disabled: '#666666',      // 비활성 텍스트
  },

  // ── Accent (ColorHunt + 보조) ──────────────────
  accent: {
    success: '#10b981',       // 그린 (보조)
    warning: '#F6E7BC',       // 웜 베이지 (ColorHunt)
    error: '#ef4444',         // 레드 (보조)
    info: '#0AC4E0',          // 밝은 시안 (ColorHunt)
  },

  // ── Border (순수 회색) ─────────────────────────
  divider: 'rgba(255, 255, 255, 0.10)',
  border: 'rgba(255, 255, 255, 0.06)',

  // ── Overlay ────────────────────────────────────
  overlay: {
    light: 'rgba(255, 255, 255, 0.3)',
    medium: 'rgba(255, 255, 255, 0.5)',
    dark: 'rgba(0, 0, 0, 0.3)',
  },
} as const

export type ColorPalette = typeof colors
