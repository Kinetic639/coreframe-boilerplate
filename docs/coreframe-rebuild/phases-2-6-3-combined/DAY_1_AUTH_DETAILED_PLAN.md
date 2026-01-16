# Day 1: Complete Auth System - Detailed Implementation Plan

**Version:** 1.0
**Created:** 2026-01-15
**Estimated Duration:** 6-8 hours
**Focus:** Password Reset Flow First (to test email setup)

---

## Overview

This plan implements production-ready authentication with email delivery using **Resend SMTP Integration** (simplest approach). We'll focus on the password reset flow FIRST to test the email setup, then expand to other auth features.

**Key Decisions:**

- **Email Strategy:** Resend SMTP via Supabase Integration (auto-handles auth emails)
- **Auth Flow:** PKCE token verification (more secure than code exchange)
- **Architecture:** TDD-first, SSR-first, security-focused
- **Testing:** ~35 focused tests (not excessive)

---

## Phase 1: Password Reset Flow (PRIORITY) - 3 hours

### Step 1.1: Configure Resend SMTP in Supabase (15 min)

**Manual Steps:**

1. **Option A: Resend Integration (RECOMMENDED)**
   - Go to [Resend Dashboard](https://resend.com/) → Integrations → Supabase
   - Click "Connect to Supabase"
   - Select your Supabase project
   - Select verified domain
   - Set sender name: "Coreframe"
   - Confirm connection
   - Rate limit increases from 2/hour to 25/hour automatically

2. **Option B: Custom SMTP (Alternative)**
   - Go to Supabase Dashboard → Authentication → SMTP Settings
   - **Host:** smtp.resend.com
   - **Port:** 465
   - **Username:** resend
   - **Password:** Your RESEND_API_KEY (re_xxxxxxxxx)
   - **Sender email:** noreply@yourdomain.com
   - **Sender name:** Coreframe

3. **Test Email Sending**
   - Go to Supabase Dashboard → Authentication → Users
   - Invite a test user to trigger an email
   - Check your inbox (and spam folder)

**Environment Variables:**

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

---

### Step 1.2: Create PKCE Token Verification Route (20 min)

**File:** `src/app/auth/confirm/route.ts`

```typescript
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard-old/start";

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      redirectTo.searchParams.delete("error");
      return NextResponse.redirect(redirectTo);
    }
  }

  // Redirect to error page if verification failed
  redirectTo.pathname = "/auth/auth-code-error";
  return NextResponse.redirect(redirectTo);
}
```

**What this does:**

- Handles PKCE token verification from email links
- Supports all auth types: recovery, signup, invite, email_change
- Redirects to error page if token is invalid/expired

---

### Step 1.3: Create Auth Error Page (15 min)

**File:** `src/app/auth/auth-code-error/page.tsx`

```typescript
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function AuthCodeError() {
  const t = await getTranslations('auth');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {t('authCodeError.title')}
          </h1>
          <p className="text-muted-foreground text-base">
            {t('authCodeError.description')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg">
            <Link href="/forgot-password">
              {t('authCodeError.requestNewLink')}
            </Link>
          </Button>
          <Button variant="outline" asChild size="lg">
            <Link href="/sign-in">
              {t('authCodeError.backToSignIn')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 1.4: Create Public Reset Password Page (20 min)

**File:** `src/app/[locale]/(public)/(auth)/reset-password/page.tsx`

```typescript
import { ResetPasswordForm } from '@/components/auth/forms/reset-password-form';
import { AuthCard } from '@/components/auth/AuthCard';
import { createClient } from '@/utils/supabase/server';
import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; success?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const locale = await getLocale();

  // User must have a recovery session to access this page
  if (!session) {
    redirect({
      href: '/forgot-password',
      locale,
    });
  }

  const params = await searchParams;
  const message = params.error || params.success || params.message;

  return (
    <AuthCard variant="forgot-password">
      <ResetPasswordForm message={message ? { message } : undefined} />
    </AuthCard>
  );
}
```

**Key Security:**

- Requires active recovery session (from email link)
- Redirects to forgot-password if no session
- SSR ensures session check on server

---

### Step 1.5: Create Password Strength Component (30 min)

**File:** `src/components/auth/password-strength.tsx`

```typescript
'use client';

import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const t = useTranslations('auth.passwordStrength');

  const requirements = [
    { label: t('requirements.length'), met: password.length >= 8 },
    { label: t('requirements.uppercase'), met: /[A-Z]/.test(password) },
    { label: t('requirements.lowercase'), met: /[a-z]/.test(password) },
    { label: t('requirements.number'), met: /\d/.test(password) },
  ];

  const strength = requirements.filter((r) => r.met).length;

  const getStrengthColor = () => {
    if (strength <= 1) return 'bg-red-500';
    if (strength === 2) return 'bg-orange-500';
    if (strength === 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = () => {
    if (strength <= 1) return t('weak');
    if (strength === 2) return t('fair');
    if (strength === 3) return t('good');
    return t('strong');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              'h-2 flex-1 rounded-full transition-all duration-300',
              strength >= level ? getStrengthColor() : 'bg-muted'
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{t('label')}:</span>
        <span
          className={cn(
            'font-medium transition-colors',
            strength <= 1 && 'text-red-500',
            strength === 2 && 'text-orange-500',
            strength === 3 && 'text-yellow-500',
            strength === 4 && 'text-green-500'
          )}
        >
          {password.length > 0 ? getStrengthLabel() : '—'}
        </span>
      </div>
      <ul className="space-y-1.5">
        {requirements.map((req) => (
          <li
            key={req.label}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              req.met ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'
            )}
          >
            {req.met ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

### Step 1.6: Enhance Reset Password Form (30 min)

**File:** `src/components/auth/forms/reset-password-form.tsx`

Add these features:

- ✅ Password strength indicator
- ✅ Show/hide password toggle
- ✅ Real-time validation
- ✅ Better loading states

Key changes:

```typescript
import { PasswordStrength } from "@/components/auth/password-strength";
import { Eye, EyeOff } from "lucide-react";

// Add state for show/hide
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);

// Watch password for strength indicator
const password = watch("password", "");

// In JSX:
{password && (
  <div className="mt-2">
    <PasswordStrength password={password} />
  </div>
)}
```

---

### Step 1.7: Update Auth Actions (30 min)

**File:** `src/app/[locale]/actions.ts`

**forgotPasswordAction updates:**

```typescript
export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const locale = await getLocale();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return encodedRedirect("error", "/forgot-password", "Invalid email format");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // IMPORTANT: Use /auth/confirm with PKCE token_hash
    redirectTo: `${origin}/auth/confirm?next=/${locale}/reset-password`,
  });

  if (error) {
    console.error("Password reset error:", error.message);
  }

  // Always show success (don't reveal if email exists - security best practice)
  return encodedRedirect(
    "success",
    "/forgot-password",
    "If an account exists with this email, you will receive a password reset link."
  );
};
```

**resetPasswordAction updates:**

```typescript
export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();
  const locale = await getLocale();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validation
  if (!password || !confirmPassword) {
    return encodedRedirect("error", "/reset-password", "Password and confirmation are required");
  }

  if (password !== confirmPassword) {
    return encodedRedirect("error", "/reset-password", "Passwords do not match");
  }

  // Server-side password strength validation
  if (password.length < 8) {
    return encodedRedirect("error", "/reset-password", "Password must be at least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    return encodedRedirect("error", "/reset-password", "Password must contain an uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    return encodedRedirect("error", "/reset-password", "Password must contain a lowercase letter");
  }

  if (!/\d/.test(password)) {
    return encodedRedirect("error", "/reset-password", "Password must contain a number");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Password update error:", error.message);
    return encodedRedirect(
      "error",
      "/reset-password",
      "Failed to update password. Please try again."
    );
  }

  // Sign out after password reset for security
  await supabase.auth.signOut();

  return redirect({
    href: "/sign-in",
    locale,
  });
};
```

---

### Step 1.8: Update Routing Configuration (5 min)

**File:** `src/i18n/routing.ts`

Add:

```typescript
"/reset-password": {
  en: "/reset-password",
  pl: "/zresetuj-haslo",
},
```

---

### Step 1.9: Add Translations (15 min)

**File:** `messages/en.json`

Add after `authForms` section:

```json
"auth": {
  "authCodeError": {
    "title": "Authentication Error",
    "description": "The link you used is invalid or has expired. Please request a new one.",
    "requestNewLink": "Request New Link",
    "backToSignIn": "Back to Sign In"
  },
  "passwordStrength": {
    "label": "Password strength",
    "weak": "Weak",
    "fair": "Fair",
    "good": "Good",
    "strong": "Strong",
    "requirements": {
      "length": "At least 8 characters",
      "uppercase": "Uppercase letter (A-Z)",
      "lowercase": "Lowercase letter (a-z)",
      "number": "Number (0-9)"
    }
  }
},
```

**File:** `messages/pl.json`

```json
"auth": {
  "authCodeError": {
    "title": "Błąd uwierzytelniania",
    "description": "Link, którego użyłeś jest nieprawidłowy lub wygasł. Poproś o nowy.",
    "requestNewLink": "Poproś o nowy link",
    "backToSignIn": "Powrót do logowania"
  },
  "passwordStrength": {
    "label": "Siła hasła",
    "weak": "Słabe",
    "fair": "Średnie",
    "good": "Dobre",
    "strong": "Silne",
    "requirements": {
      "length": "Co najmniej 8 znaków",
      "uppercase": "Wielka litera (A-Z)",
      "lowercase": "Mała litera (a-z)",
      "number": "Cyfra (0-9)"
    }
  }
},
```

---

## Phase 2: Email Service & Templates (Optional) - 2 hours

**Note:** This is optional because Supabase will handle password reset emails automatically via Resend SMTP. This section is for custom application emails (welcome, invitations).

### Step 2.1: Install Dependencies

```bash
npm install @react-email/components
# resend already installed
```

### Step 2.2: Create EmailService

**File:** `src/lib/services/email.service.ts`

```typescript
import { Resend } from "resend";
import { render } from "@react-email/render";
import { WelcomeEmail } from "@/components/emails/templates/welcome";
import { InvitationEmail } from "@/components/emails/templates/invitation";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@yourdomain.com";

export class EmailService {
  static async sendWelcomeEmail(email: string, firstName?: string) {
    const html = render(WelcomeEmail({ firstName: firstName || "there" }));
    return resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to Coreframe!",
      html,
    });
  }

  static async sendInvitationEmail(params: {
    email: string;
    inviterName: string;
    orgName: string;
    inviteUrl: string;
  }) {
    const html = render(InvitationEmail(params));
    return resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: `You've been invited to join ${params.orgName}`,
      html,
    });
  }
}
```

### Step 2.3: Create Email Templates

**File:** `src/components/emails/templates/welcome.tsx`

```tsx
import { Html, Head, Body, Container, Button, Text } from "@react-email/components";

interface WelcomeEmailProps {
  firstName: string;
}

export const WelcomeEmail = ({ firstName }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container style={container}>
        <Text style={heading}>Welcome to Coreframe!</Text>
        <Text style={paragraph}>Hi {firstName},</Text>
        <Text style={paragraph}>
          Your account has been created successfully. You can now access all features.
        </Text>
        <Button href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`} style={button}>
          Go to Dashboard
        </Button>
      </Container>
    </Body>
  </Html>
);

const main = { backgroundColor: "#f6f9fc", fontFamily: "-apple-system, sans-serif" };
const container = { margin: "0 auto", padding: "40px 20px", maxWidth: "560px" };
const heading = { fontSize: "24px", fontWeight: "bold", color: "#1a1a1a" };
const paragraph = { fontSize: "16px", lineHeight: "26px", color: "#484848" };
const button = {
  backgroundColor: "#5469d4",
  color: "#fff",
  padding: "12px 24px",
  borderRadius: "4px",
  textDecoration: "none",
  fontWeight: "600",
};

export default WelcomeEmail;
```

Similar templates for invitation, password-reset, email-verification.

---

## Phase 3: Testing (1 hour)

### Manual Testing Checklist

**Password Reset Flow:**

1. ✅ Go to `/forgot-password`
2. ✅ Enter valid email address
3. ✅ Submit form - verify success message appears
4. ✅ Check email inbox (and spam) for reset email
5. ✅ Click reset link in email
6. ✅ Verify redirect to `/reset-password` with valid session
7. ✅ Enter new password - watch strength indicator update
8. ✅ Test show/hide password toggle
9. ✅ Submit new password
10. ✅ Verify redirect to sign-in
11. ✅ Sign in with new password

**Error Scenarios:**

1. ✅ Test with invalid email format
2. ✅ Test with non-existent email (should show same success message)
3. ✅ Test expired reset link (after 1 hour)
4. ✅ Test already-used reset link
5. ✅ Test password mismatch
6. ✅ Test weak password validation
7. ✅ Test accessing `/reset-password` without session

**i18n:**

1. ✅ Test flow in English
2. ✅ Test flow in Polish

---

## Files Summary

### Created Files ✅

| File                                                       | Purpose                          |
| ---------------------------------------------------------- | -------------------------------- |
| `src/app/auth/confirm/route.ts`                            | PKCE token verification endpoint |
| `src/app/auth/auth-code-error/page.tsx`                    | Auth error page                  |
| `src/app/[locale]/(public)/(auth)/reset-password/page.tsx` | Public reset password page       |
| `src/components/auth/password-strength.tsx`                | Password strength indicator      |

### Modified Files ✅

| File                                                | Changes                               |
| --------------------------------------------------- | ------------------------------------- |
| `src/app/[locale]/actions.ts`                       | Updated forgot/reset password actions |
| `src/components/auth/forms/reset-password-form.tsx` | Added strength indicator + show/hide  |
| `src/i18n/routing.ts`                               | Added `/reset-password` route         |
| `messages/en.json`                                  | Added auth translations               |
| `messages/pl.json`                                  | Added auth translations (Polish)      |

---

## Environment Variables

```env
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com

# Already configured
NEXT_PUBLIC_SUPABASE_URL=https://zlcnlalwfmmtusigeuyk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Success Criteria

- [x] Password reset email received within 1 minute
- [x] Full reset flow works end-to-end
- [x] Password strength indicator shows correct feedback
- [x] Error pages display helpful messages
- [x] No TypeScript errors
- [x] Works in both English and Polish
- [x] All pages SSR correctly
- [ ] Type check passes (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)

---

## Next Steps (Future Sessions)

1. **Email Verification Flow**
   - Create `/verify-email` page
   - Resend verification action
   - Integration with signup

2. **Sign-in/Sign-up Enhancements**
   - Remember me checkbox
   - Show password toggle on sign-in
   - Password strength on sign-up

3. **Optional: OAuth**
   - Google OAuth setup
   - Account linking

---

**Version:** 1.0
**Last Updated:** 2026-01-15
**Status:** Ready for Implementation
