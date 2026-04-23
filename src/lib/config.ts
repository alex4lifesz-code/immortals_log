// src/lib/config.ts — Centralized application configuration

export const THEME_CLASS_NAMES = [
  "discord",
  "forest",
  "ink-dragon",
  "evolved-ink-dragon",
  "lemon-dragon",
  "ying-yang",
  "ying-yang-light",
  "ying-yang-magenta",
  "phoenix-bloom",
  "storm-chains",
  "obsidian-ember",
  "mist-cultivator",
  "frost-sect",
  "heavenly-sword",
] as const;

export const CONFIG = {
  auth: {
    minPasswordLength: 4,
    maxPasswordLength: 100,
    bcryptRounds: 10,
    sessionDurationDefault: "24h",
    sessionDurationRememberMe: "7d",
    passwordRequirements: {
      minLength: 4,
      requireUppercase: false,
      requireLowercase: false,
      requireNumber: false,
      requireSpecial: false,
    },
  },

  rateLimit: {
    login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    register: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
    api: { windowMs: 60 * 1000, maxRequests: 100 },
    import: { windowMs: 60 * 60 * 1000, maxRequests: 5 },
  },

  limits: {
    maxImportLogs: 10000,
    maxImportExercises: 500,
    maxCommentLength: 500,
    maxNoteLength: 2000,
    maxUsernameLength: 30,
    minUsernameLength: 3,
  },

  connectivity: {
    checkIntervalMs: 30000,
    timeoutMs: 7000,
  },

  themes: THEME_CLASS_NAMES,

  bandResistance: {
    options: [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30] as const,
    colors: {
      yellow: 2.5,
      red: 5,
      green: 7.5,
      blue: 10,
      black: 12.5,
      purple: 15,
      orange: 20,
      gray: 25,
      gold: 30,
    } as const,
  },

  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },

  analytics: {
    volumeMultipliers: {
      reps: 1.4,
      holdTime: 0.8,
      volume: 0.02,
      level: 10,
    },
  },
} as const;

export type Theme = (typeof THEME_CLASS_NAMES)[number];
