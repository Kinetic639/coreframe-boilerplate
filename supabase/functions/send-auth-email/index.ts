import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://www.ambra-system.com";
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@ambra-system.com";
const FROM_NAME = "Ambra System";

// ---------------------------------------------------------------------------
// I18n
// ---------------------------------------------------------------------------

type SupportedLocale = "pl" | "en";

const t = {
  pl: {
    signup: {
      subject: "Potwierdź rejestrację w Ambra",
      heading: "Potwierdź swój adres e-mail",
      body: "Dziękujemy za rejestrację! Kliknij przycisk poniżej, aby potwierdzić adres e-mail i aktywować konto.",
      button: "Potwierdź adres e-mail",
      linkLabel: "Lub skopiuj ten link:",
      disclaimer: "Jeśli nie zakładałeś konta w Ambra, zignoruj tę wiadomość.",
    },
    recovery: {
      subject: "Zresetuj hasło w Ambra",
      heading: "Zresetuj swoje hasło",
      body: "Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta Ambra. Kliknij przycisk poniżej, aby ustawić nowe hasło. Link wygasa po 1 godzinie.",
      button: "Zresetuj hasło",
      linkLabel: "Lub skopiuj ten link:",
      disclaimer: "Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.",
    },
    footer: "© 2025 Ambra System. Wszelkie prawa zastrzeżone.",
  },
  en: {
    signup: {
      subject: "Confirm your Ambra signup",
      heading: "Confirm your email address",
      body: "Thanks for signing up! Click the button below to confirm your email address and activate your account.",
      button: "Confirm Email Address",
      linkLabel: "Or copy this link:",
      disclaimer: "If you did not create an Ambra account, you can ignore this email.",
    },
    recovery: {
      subject: "Reset your Ambra password",
      heading: "Reset your password",
      body: "We received a request to reset the password for your Ambra account. Click the button below to set a new password. This link expires in 1 hour.",
      button: "Reset Password",
      linkLabel: "Or copy this link:",
      disclaimer: "If you did not request a password reset, you can safely ignore this email.",
    },
    footer: "© 2025 Ambra System. All rights reserved.",
  },
};

// ---------------------------------------------------------------------------
// HTML renderer
// ---------------------------------------------------------------------------

function renderEmail(params: {
  heading: string;
  body: string;
  button: string;
  confirmUrl: string;
  linkLabel: string;
  disclaimer: string;
  footer: string;
}): string {
  const { heading, body, button, confirmUrl, linkLabel, disclaimer, footer } = params;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

        <!-- Logo header -->
        <tr><td style="background:#ffffff;padding:24px 40px;border-radius:8px 8px 0 0;border-bottom:1px solid #e9ecef">
          <a href="${SITE_URL}" style="text-decoration:none;display:inline-flex;align-items:baseline;gap:2px">
            <span style="color:#F0A205;font-size:20px;font-weight:700">Ambra</span>
            <span style="color:#9ca3af;font-size:13px;font-weight:500;margin-left:2px">system</span>
          </a>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px 40px 48px">
          <h2 style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:600;letter-spacing:-0.3px">${heading}</h2>
          <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6">${body}</p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td style="border-radius:6px;background:#F0A205">
              <a href="${confirmUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px">${button}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 6px;color:#9ca3af;font-size:12px">${linkLabel}</p>
          <p style="margin:0;font-size:12px;word-break:break-all">
            <a href="${confirmUrl}" style="color:#F0A205;text-decoration:none">${confirmUrl}</a>
          </p>
        </td></tr>

        <!-- Footer disclaimer -->
        <tr><td style="background:#f9fafb;border:1px solid #e9ecef;border-top:none;border-radius:0 0 8px 8px;padding:16px 40px">
          <p style="margin:0;color:#d1d5db;font-size:12px">${disclaimer}</p>
        </td></tr>

        <!-- Copyright -->
        <tr><td style="padding:20px 0;text-align:center">
          <p style="margin:0;color:#d1d5db;font-size:12px">${footer}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getUserLocale(userId: string): Promise<SupportedLocale> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${userId}&select=locale&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (rows?.[0]?.locale === "en") return "en";
    }
  } catch {
    // fall through to default
  }
  return "pl";
}

function buildConfirmUrl(actionType: string, tokenHash: string, locale: SupportedLocale): string {
  if (actionType === "signup") {
    return `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=signup`;
  }
  // recovery
  return `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password&locale=${locale}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const { user, email_data } = payload ?? {};

    if (!user?.email || !email_data?.email_action_type) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { email_action_type, token_hash } = email_data as {
      email_action_type: string;
      token_hash: string;
    };

    // Only handle signup and recovery — pass everything else back to Supabase default
    if (!["signup", "recovery"].includes(email_action_type)) {
      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const locale = await getUserLocale(user.id);
    const strings = t[locale][email_action_type as "signup" | "recovery"];
    const confirmUrl = buildConfirmUrl(email_action_type, token_hash, locale);

    const html = renderEmail({
      heading: strings.heading,
      body: strings.body,
      button: strings.button,
      confirmUrl,
      linkLabel: strings.linkLabel,
      disclaimer: strings.disclaimer,
      footer: t[locale].footer,
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [user.email],
        subject: strings.subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error("[send-auth-email] Resend error:", err);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-auth-email] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
