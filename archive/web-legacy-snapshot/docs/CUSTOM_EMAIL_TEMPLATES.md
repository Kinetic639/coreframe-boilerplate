# Custom Email Templates with Supabase Auth

This guide explains how to use custom React Email templates with Supabase authentication emails (password reset, email verification, etc.).

## Overview

Supabase has two approaches for sending auth emails:

1. **SMTP Integration (Default)** - Supabase sends emails using its built-in templates via your SMTP provider
2. **Custom Email Templates (Advanced)** - You control the email content and sending

Currently, we're using **SMTP Integration** for Supabase auth emails, which means Supabase automatically sends password reset and verification emails using their default templates.

However, we've created custom React Email templates that you can use for:

- Application emails (welcome, invitations)
- Future migration to fully custom auth emails

## Current Setup

### Supabase Auth Emails (SMTP Integration)

**What it does:**

- Password reset emails
- Email verification emails
- Magic link emails

**How it works:**

1. Supabase Dashboard → Authentication → Email Templates
2. You can customize the Supabase templates (HTML/text)
3. Emails sent via Resend SMTP automatically

**Current Configuration:**

- **SMTP Host:** smtp.resend.com
- **SMTP Port:** 465
- **SMTP Username:** resend
- **SMTP Password:** Your RESEND_API_KEY
- **Sender Email:** lovable639@gmail.com (sandbox mode)
- **Sender Name:** Coreframe

## Custom Email Templates

### Files

We've created React Email templates in `/src/components/emails/`:

1. **password-reset.tsx** - Custom password reset email
2. **welcome.tsx** - Welcome email for new users
3. **invitation.tsx** - Organization invitation email

### EmailService Usage

The `EmailService` class (`/src/server/services/email.service.ts`) provides methods to send emails using these templates:

```typescript
import { EmailService } from "@/server/services/email.service";

const emailService = new EmailService();

// Send password reset with custom template
await emailService.sendPasswordResetEmail(
  "user@example.com",
  "https://app.com/reset-password?token=..."
);

// Send welcome email
await emailService.sendWelcomeEmailWithTemplate("user@example.com", "John");

// Send invitation email
await emailService.sendInvitationEmailWithTemplate(
  "newuser@example.com",
  "Acme Corp",
  "John Doe",
  "https://app.com/accept-invite?token=..."
);
```

## Option 1: Use Supabase Email Templates (Current - Recommended)

**Pros:**

- ✅ Simple setup
- ✅ Supabase handles email delivery
- ✅ Rate limiting built-in
- ✅ Token management handled automatically

**Cons:**

- ❌ Limited template customization
- ❌ Must edit in Supabase Dashboard
- ❌ Can't use React components

**How to customize:**

1. Go to Supabase Dashboard → Authentication → Email Templates
2. Select template type (e.g., "Reset Password")
3. Edit the HTML and plain text versions
4. Use template variables: `{{ .ConfirmationURL }}`, `{{ .Email }}`, etc.
5. Save changes

**Example Supabase Template Variables:**

- `{{ .ConfirmationURL }}` - The reset/verification link
- `{{ .Token }}` - The OTP token
- `{{ .TokenHash }}` - The token hash
- `{{ .Email }}` - User's email
- `{{ .SiteURL }}` - Your site URL

## Option 2: Use Custom Email Hooks (Advanced - Not Implemented)

**Note:** This approach requires significant setup and is not currently implemented. We document it here for future reference.

### Overview

Supabase supports custom email hooks that allow you to send emails via HTTP webhooks instead of SMTP. This gives you full control over email content and delivery.

### Setup Steps

#### 1. Create Email Webhook Endpoint

Create an API route that Supabase will call:

```typescript
// src/app/api/email-hooks/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { EmailService } from "@/server/services/email.service";

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get("x-supabase-signature");
    if (!verifySignature(signature, await request.text())) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { email, type, token_hash, confirmation_url } = await request.json();

    const emailService = new EmailService();

    // Handle different email types
    switch (type) {
      case "recovery":
        await emailService.sendPasswordResetEmail(email, confirmation_url);
        break;
      case "signup":
        await emailService.sendWelcomeEmailWithTemplate(email, "User");
        break;
      // ... other types
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email hook error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
```

#### 2. Configure Supabase Webhook

1. Go to Supabase Dashboard → Authentication → Hooks
2. Enable "Custom Email Delivery"
3. Set webhook URL: `https://your-app.com/api/email-hooks/send`
4. Add webhook secret for signature verification

#### 3. Update Environment Variables

```bash
# .env.local
SUPABASE_EMAIL_HOOK_SECRET=your_webhook_secret_here
```

#### 4. Test the Setup

```bash
# Test password reset flow
curl -X POST https://your-app.com/api/email-hooks/send \
  -H "Content-Type: application/json" \
  -H "x-supabase-signature: YOUR_SIGNATURE" \
  -d '{
    "email": "user@example.com",
    "type": "recovery",
    "token_hash": "abc123",
    "confirmation_url": "https://app.com/auth/confirm?token_hash=abc123"
  }'
```

## Comparing Approaches

| Feature          | SMTP Integration | Custom Email Hooks    |
| ---------------- | ---------------- | --------------------- |
| Setup Complexity | Low              | High                  |
| Template Control | Limited          | Full Control          |
| React Components | No               | Yes                   |
| Testing          | Supabase handles | You handle            |
| Maintenance      | Low              | High                  |
| Delivery         | Supabase manages | You manage            |
| Cost             | SMTP fees only   | SMTP + infrastructure |

## Recommendations

### For Most Projects (Current Setup)

**Use Supabase SMTP Integration**

This is what we're currently using. It's simple, reliable, and works well for most use cases.

**When to use:**

- You want simple setup
- You're okay with Supabase's default templates
- You need reliable email delivery without managing infrastructure

### For Advanced Customization

**Use Custom Email Hooks**

Only implement this if you need:

- Full brand control over auth emails
- React components in auth emails
- Complex email logic
- Integration with other services

## Development & Testing

### Local Email Testing

For local development, you can use:

1. **Resend Test Mode** - Free tier allows testing
2. **MailHog** - Local email server (catches all outgoing emails)
3. **Mailtrap** - Email testing service

### Preview Email Templates

To preview your React Email templates locally:

```bash
# Install React Email dev tools
npm install -D react-email

# Start email preview server
npx react-email dev
```

This will open a browser at `http://localhost:3000` showing all your email templates.

### Test Email Sending

```typescript
// Test in a server action or API route
import { EmailService } from "@/server/services/email.service";

const emailService = new EmailService();

// Test password reset email
const result = await emailService.sendPasswordResetEmail(
  "test@example.com",
  "https://app.com/reset-password?token=test"
);

console.log("Email sent:", result);
```

## Production Checklist

Before going to production with custom emails:

- [ ] Verify domain in Resend dashboard
- [ ] Update `RESEND_FROM_EMAIL` to use verified domain
- [ ] Test all email types (reset, verification, welcome)
- [ ] Check emails don't go to spam
- [ ] Set up SPF, DKIM, and DMARC records
- [ ] Monitor email delivery rates
- [ ] Set up email bounce handling
- [ ] Configure rate limiting

## Troubleshooting

### Emails not sending

**Check:**

1. RESEND_API_KEY is set correctly
2. Email address is verified (sandbox mode)
3. Check Resend dashboard for delivery logs
4. Check Supabase auth logs
5. Verify SMTP configuration in Supabase

### Emails going to spam

**Fix:**

1. Verify your domain in Resend
2. Set up SPF, DKIM, DMARC records
3. Use a verified sender email
4. Warm up your email domain gradually

### Custom templates not being used

**Verify:**

- If using SMTP integration, templates must be edited in Supabase Dashboard
- If using email hooks, ensure webhook is configured correctly
- Check webhook logs for errors

## Resources

- [Supabase Auth Email Documentation](https://supabase.com/docs/guides/auth/auth-email)
- [React Email Documentation](https://react.email/)
- [Resend Documentation](https://resend.com/docs)
- [Email Deliverability Best Practices](https://www.validity.com/resource-center/email-deliverability-guide/)

## Next Steps

1. **Stay with SMTP Integration** (Recommended)
   - Customize Supabase templates in dashboard
   - Use custom templates for application emails only

2. **Migrate to Custom Hooks** (Advanced)
   - Follow "Option 2" setup above
   - Implement webhook endpoint
   - Test thoroughly before production
   - Set up monitoring and alerting
