#!/usr/bin/env bash
# =============================================================================
# TARGET Project — Auth System Setup
# =============================================================================
# Purpose: Configures the full custom auth email system on the TARGET Supabase
#          project (rjeraydumwechpjjzrus) to match LEGACY behavior exactly.
#
# Run this script after applying all SQL migrations to a fresh TARGET project.
#
# What this covers:
#   1. Deploy send-auth-email edge function
#   2. Set edge function secrets (RESEND_API_KEY, NEXT_PUBLIC_SITE_URL, RESEND_FROM_EMAIL)
#   3. Configure Supabase Auth via Management API:
#      - site_url + uri_allow_list
#      - Send Email hook → send-auth-email edge function
#      - Custom Access Token hook → custom_access_token_hook postgres function
#      - Resend SMTP (smtp.resend.com:465)
#      - Custom branded email templates (confirmation + recovery)
#      - Rate limit: 60 emails/hour
#
# Prerequisites:
#   - SUPABASE_ACCESS_TOKEN set (or passed as env var)
#   - RESEND_API_KEY set (or passed as env var)
#   - npx / supabase CLI available
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx RESEND_API_KEY=re_xxx bash setup-auth.sh
#
# Or export variables first:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxx
#   export RESEND_API_KEY=re_xxx
#   bash setup-auth.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PROJECT_REF="rjeraydumwechpjjzrus"
SITE_URL="https://www.ambra-system.com"
FROM_EMAIL="noreply@ambra-system.com"
FROM_NAME="Ambra System"
SMTP_HOST="smtp.resend.com"
SMTP_PORT="465"
SMTP_USER="resend"
EDGE_FN_NAME="send-auth-email"
EDGE_FN_SOURCE="../supabase/functions/send-auth-email/index.ts"

# Validate required env vars
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${RESEND_API_KEY:?RESEND_API_KEY is required}"

MGMT_HEADERS=(
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}"
  -H "Content-Type: application/json"
)

echo ""
echo "=== TARGET Auth Setup ==="
echo "Project: ${PROJECT_REF}"
echo "Site URL: ${SITE_URL}"
echo ""

# ---------------------------------------------------------------------------
# Step 1 — Deploy send-auth-email edge function
# ---------------------------------------------------------------------------
# The edge function intercepts Supabase Auth send-email events for
# 'signup' and 'recovery' action types. It:
#   - reads user locale from user_preferences table
#   - builds the correct frontend confirm URL (token_hash style)
#   - sends branded HTML email via Resend API
#
# verify_jwt=false: required — Supabase Auth calls the hook without a user JWT.
# ---------------------------------------------------------------------------

echo "[1/3] Deploying edge function: ${EDGE_FN_NAME}..."

SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN}" npx supabase functions deploy "${EDGE_FN_NAME}" \
  --project-ref "${PROJECT_REF}" \
  --no-verify-jwt

echo "      ✓ Edge function deployed (verify_jwt=false)"

# ---------------------------------------------------------------------------
# Step 2 — Set edge function secrets
# ---------------------------------------------------------------------------
# RESEND_API_KEY       — Resend API key for email delivery
# NEXT_PUBLIC_SITE_URL — Base URL used when building confirm/reset links
# RESEND_FROM_EMAIL    — Sender address. MUST be from a verified Resend domain.
#                        ambra-system.com is verified. Do NOT use
#                        onboarding@resend.dev when a custom domain is
#                        verified — Resend restricts that address to the
#                        account owner only.
#
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by the runtime.
# ---------------------------------------------------------------------------

echo "[2/3] Setting edge function secrets..."

SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN}" npx supabase secrets set \
  RESEND_API_KEY="${RESEND_API_KEY}" \
  NEXT_PUBLIC_SITE_URL="${SITE_URL}" \
  RESEND_FROM_EMAIL="${FROM_EMAIL}" \
  --project-ref "${PROJECT_REF}"

echo "      ✓ Secrets set: RESEND_API_KEY, NEXT_PUBLIC_SITE_URL, RESEND_FROM_EMAIL"

# ---------------------------------------------------------------------------
# Step 3 — Configure Supabase Auth via Management API
# ---------------------------------------------------------------------------
# These settings cannot be done via SQL or the Supabase CLI.
# They are applied via the Management REST API.
#
# site_url:
#   The base URL Supabase embeds in default auth emails and uses for
#   redirect validation. Must match the production frontend domain.
#   Incorrect value (e.g. localhost:3000) causes auth emails to contain
#   wrong links and OTP redirects to fail.
#
# uri_allow_list:
#   Whitelist of allowed redirect URLs after auth flows. Wildcards supported.
#   Must include the production domain and any preview/staging domains.
#
# hook_send_email_enabled + hook_send_email_uri:
#   Routes all auth email sending through the send-auth-email edge function.
#   Without this, Supabase uses its default mailer (low rate limits, generic
#   Supabase-branded emails, default URL format incompatible with our
#   /auth/confirm route which expects token_hash params).
#
# hook_custom_access_token_enabled + hook_custom_access_token_uri:
#   Routes JWT minting through custom_access_token_hook postgres function.
#   This enriches JWTs with the user's role assignments (roles[] in claims).
#
# smtp_host / smtp_port / smtp_user / smtp_pass:
#   Resend SMTP relay used as the underlying mail transport.
#   Required alongside the Send Email hook — used for email types the hook
#   does not handle (invite, magic_link, etc.) and as delivery infrastructure.
#   smtp_pass = RESEND_API_KEY (Resend uses the API key as SMTP password).
#
# mailer_templates_confirmation_content:
#   Custom HTML template for signup confirmation emails. Uses Supabase
#   template variables: {{ .ConfirmationURL }}
#   This template is used when the hook falls back (non-signup/recovery types).
#
# mailer_templates_recovery_content:
#   Custom HTML template for password reset emails. Uses custom URL format:
#   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&...
#   This generates the token_hash style URL that /auth/confirm expects.
#
# rate_limit_email_sent:
#   Max emails per hour. Default is ~3-4. Set to 60 to match LEGACY and
#   avoid rate limit errors during testing and normal usage.
# ---------------------------------------------------------------------------

echo "[3/3] Configuring Supabase Auth settings..."

# Branded HTML email templates (same as LEGACY)
CONFIRMATION_TEMPLATE='<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'"'"'Segoe UI'"'"',Roboto,'"'"'Helvetica Neue'"'"',sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#ffffff;padding:28px 40px 0;border-bottom:1px solid #e9ecef"><table cellpadding="0" cellspacing="0"><tr><td><a href="https://ambra-system.com" style="text-decoration:none;font-size:20px;font-weight:700;line-height:1"><span style="color:#F0A205">Ambra</span><span style="color:#9ca3af;font-size:14px;font-weight:500;margin-left:2px">system</span></a></td></tr></table></td></tr></table><tr><td style="background:#ffffff;padding:40px 40px 48px"><h2 style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:600;letter-spacing:-0.3px">Confirm your email address</h2><p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6">Thanks for signing up! Click the button below to confirm your email address and activate your account.</p><table cellpadding="0" cellspacing="0" style="margin-bottom:28px"><tr><td style="border-radius:6px;background:#F0A205"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px">Confirm Email Address</a></td></tr></table><p style="margin:0 0 6px;color:#9ca3af;font-size:12px">Or copy and paste this link:</p><p style="margin:0;font-size:12px;word-break:break-all"><a href="{{ .ConfirmationURL }}" style="color:#F0A205;text-decoration:none">{{ .ConfirmationURL }}</a></p></td></tr><tr><td style="background:#f9fafb;border:1px solid #e9ecef;border-top:none;border-radius:0 0 8px 8px;padding:16px 40px"><p style="margin:0;color:#d1d5db;font-size:12px">If you did not create an Ambra account, you can ignore this email.</p></td></tr><tr><td style="padding:24px 0;text-align:center"><p style="margin:0;color:#d1d5db;font-size:12px">&copy; 2025 Ambra System. All rights reserved.</p></td></tr></table></td></tr></table></body></html>'

RECOVERY_TEMPLATE='<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'"'"'Segoe UI'"'"',Roboto,'"'"'Helvetica Neue'"'"',sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#ffffff;padding:28px 40px 0;border-bottom:1px solid #e9ecef"><table cellpadding="0" cellspacing="0"><tr><td><a href="https://ambra-system.com" style="text-decoration:none;font-size:20px;font-weight:700;line-height:1"><span style="color:#F0A205">Ambra</span><span style="color:#9ca3af;font-size:14px;font-weight:500;margin-left:2px">system</span></a></td></tr></table></td></tr></table><tr><td style="background:#ffffff;padding:40px 40px 48px"><h2 style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:600;letter-spacing:-0.3px">Reset your password</h2><p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6">We received a request to reset the password for your Ambra account. Click the button below to set a new password. This link expires in 1 hour.</p><table cellpadding="0" cellspacing="0" style="margin-bottom:28px"><tr><td style="border-radius:6px;background:#F0A205"><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password&locale=pl" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px">Reset Password</a></td></tr></table><p style="margin:0 0 6px;color:#9ca3af;font-size:12px">Or copy and paste this link:</p><p style="margin:0;font-size:12px;word-break:break-all"><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password&locale=pl" style="color:#F0A205;text-decoration:none">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password&locale=pl</a></p></td></tr><tr><td style="background:#f9fafb;border:1px solid #e9ecef;border-top:none;border-radius:0 0 8px 8px;padding:16px 40px"><p style="margin:0;color:#d1d5db;font-size:12px">If you did not request a password reset, you can safely ignore this email.</p></td></tr><tr><td style="padding:24px 0;text-align:center"><p style="margin:0;color:#d1d5db;font-size:12px">&copy; 2025 Ambra System. All rights reserved.</p></td></tr></table></td></tr></table></body></html>'

node -e "
const fs = require('fs');

const patch = {
  // Auth URL config
  site_url: '${SITE_URL}',
  uri_allow_list: 'https://ambra-system.com/**,https://www.ambra-system.com/**,https://*.vercel.app/**',

  // Send Email hook → edge function
  // Intercepts signup + recovery emails; builds token_hash URLs for /auth/confirm
  hook_send_email_enabled: true,
  hook_send_email_uri: 'https://${PROJECT_REF}.supabase.co/functions/v1/${EDGE_FN_NAME}',

  // Custom Access Token hook → postgres function
  // Enriches JWTs with user role assignments (roles[] in app_metadata claims)
  hook_custom_access_token_enabled: true,
  hook_custom_access_token_uri: 'pg-functions://postgres/public/custom_access_token_hook',

  // Resend SMTP relay
  smtp_host: '${SMTP_HOST}',
  smtp_port: '${SMTP_PORT}',
  smtp_user: '${SMTP_USER}',
  smtp_pass: process.env.RESEND_API_KEY,
  smtp_admin_email: '${FROM_EMAIL}',
  smtp_sender_name: '${FROM_NAME}',
  smtp_max_frequency: 1,

  // Rate limit
  rate_limit_email_sent: 60,

  // Custom email templates
  mailer_templates_confirmation_content: process.env.CONFIRMATION_TEMPLATE,
  mailer_templates_recovery_content: process.env.RECOVERY_TEMPLATE,
};

fs.writeFileSync('/tmp/auth_patch.json', JSON.stringify(patch));
"

RESPONSE=$(RESEND_API_KEY="${RESEND_API_KEY}" \
  CONFIRMATION_TEMPLATE="${CONFIRMATION_TEMPLATE}" \
  RECOVERY_TEMPLATE="${RECOVERY_TEMPLATE}" \
  node -e "
const fs = require('fs');
const patch = {
  site_url: '${SITE_URL}',
  uri_allow_list: 'https://ambra-system.com/**,https://www.ambra-system.com/**,https://*.vercel.app/**',
  hook_send_email_enabled: true,
  hook_send_email_uri: 'https://${PROJECT_REF}.supabase.co/functions/v1/${EDGE_FN_NAME}',
  hook_custom_access_token_enabled: true,
  hook_custom_access_token_uri: 'pg-functions://postgres/public/custom_access_token_hook',
  smtp_host: '${SMTP_HOST}',
  smtp_port: '${SMTP_PORT}',
  smtp_user: '${SMTP_USER}',
  smtp_pass: process.env.RESEND_API_KEY,
  smtp_admin_email: '${FROM_EMAIL}',
  smtp_sender_name: '${FROM_NAME}',
  smtp_max_frequency: 1,
  rate_limit_email_sent: 60,
  mailer_templates_confirmation_content: process.env.CONFIRMATION_TEMPLATE,
  mailer_templates_recovery_content: process.env.RECOVERY_TEMPLATE,
};
process.stdout.write(JSON.stringify(patch));
")

curl -s -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  "${MGMT_HEADERS[@]}" \
  -d "${RESPONSE}" \
  | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const r = JSON.parse(Buffer.concat(chunks).toString());
  const ok = r.hook_send_email_enabled && r.hook_custom_access_token_enabled && r.smtp_host;
  if (!ok) { console.error('PATCH failed:', JSON.stringify(r, null, 2)); process.exit(1); }
  console.log('      ✓ site_url:', r.site_url);
  console.log('      ✓ Send Email hook:', r.hook_send_email_uri);
  console.log('      ✓ Custom Access Token hook: enabled');
  console.log('      ✓ SMTP:', r.smtp_host + ':' + r.smtp_port);
  console.log('      ✓ Sender:', r.smtp_sender_name, '<' + r.smtp_admin_email + '>');
  console.log('      ✓ Rate limit:', r.rate_limit_email_sent, 'emails/hour');
  console.log('      ✓ Email templates: confirmation + recovery set');
});
"

echo ""
echo "=== Setup complete ==="
echo ""
echo "Verify by:"
echo "  1. Registering a new account → expect branded Ambra email"
echo "  2. Confirm link → https://www.ambra-system.com/auth/confirm?token_hash=...&type=signup"
echo "  3. Clicking confirm → lands on set-password page"
echo "  4. Forgot password → branded email with reset link"
echo "  5. Reset link → https://www.ambra-system.com/auth/confirm?token_hash=...&type=recovery"
echo "  6. Clicking reset → lands on reset-password page"
echo ""
echo "Check edge function logs at:"
echo "  https://supabase.com/dashboard/project/${PROJECT_REF}/functions/${EDGE_FN_NAME}/logs"
