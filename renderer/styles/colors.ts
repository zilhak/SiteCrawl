// Color Palette
export const colors = {
  // Primary Colors
  primary: {
    main: '#667eea',
    light: '#8b9df7',
    dark: '#4c63d2',
    contrastText: '#ffffff',
  },

  // Secondary Colors
  secondary: {
    main: '#764ba2',
    light: '#9c6bc4',
    dark: '#5a3880',
    contrastText: '#ffffff',
  },

  // Background Colors (Dark Mode)
  background: {
    default: '#0a0e27',      // 메인 배경
    paper: '#151a2e',        // 카드/패널 배경
    elevated: '#1e2538',     // 호버/선택 배경
  },

  // Text Colors
  text: {
    primary: '#e4e6eb',      // 주요 텍스트
    secondary: '#b0b3b8',    // 보조 텍스트
    disabled: '#6b6f76',     // 비활성 텍스트
  },

  // Accent Colors
  accent: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },

  // Border Colors
  divider: 'rgba(255, 255, 255, 0.12)',
  border: 'rgba(255, 255, 255, 0.08)',

  // Overlay Colors
  overlay: {
    light: 'rgba(255, 255, 255, 0.3)',
    medium: 'rgba(255, 255, 255, 0.5)',
    dark: 'rgba(0, 0, 0, 0.3)',
  },
} as const

export type ColorPalette = typeof colors
