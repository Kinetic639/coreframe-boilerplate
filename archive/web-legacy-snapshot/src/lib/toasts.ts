// Toast type definitions - translation keys will be resolved at runtime
export const TOASTS = {
  "password-updated": {
    type: "success",
    translationKey: "toasts.passwordUpdated",
  },
  "password-error": {
    type: "error",
    translationKey: "toasts.passwordError",
  },
  "password-same-as-old": {
    type: "error",
    translationKey: "toasts.passwordSameAsOld",
  },
  "password-too-weak": {
    type: "error",
    translationKey: "toasts.passwordTooWeak",
  },
  "password-session-expired": {
    type: "error",
    translationKey: "toasts.passwordSessionExpired",
  },
} as const;

export type ToastKey = keyof typeof TOASTS;
