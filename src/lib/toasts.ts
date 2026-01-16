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
  "password-reset-sent": {
    type: "success",
    translationKey: "toasts.passwordResetSent",
  },
  "password-reset-error": {
    type: "error",
    translationKey: "toasts.passwordResetError",
  },
} as const;

export type ToastKey = keyof typeof TOASTS;
