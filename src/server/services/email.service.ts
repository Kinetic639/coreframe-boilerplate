import { Resend } from "resend";
import { render } from "@react-email/render";
import { PasswordResetEmail } from "@/components/emails/password-reset";
import { WelcomeEmail as WelcomeEmailTemplate } from "@/components/emails/welcome";
import { InvitationEmail as InvitationEmailTemplate } from "@/components/emails/invitation";

/**
 * Email sending options
 */
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

/**
 * Email Service Result
 */
export interface EmailServiceResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email Service
 *
 * Handles sending emails via Resend.
 * All methods are async and return standardized results.
 *
 * @example
 * ```typescript
 * const emailService = new EmailService();
 * const result = await emailService.sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome to Ambra',
 *   html: '<p>Hello!</p>',
 * });
 * ```
 */
export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ambra-system.com";
    this.fromName = process.env.RESEND_FROM_NAME || "Ambra";
  }

  /**
   * Send an email via Resend
   *
   * @param options - Email options
   * @returns Result with success status and message ID or error
   *
   * @example
   * ```typescript
   * const result = await emailService.sendEmail({
   *   to: 'user@example.com',
   *   subject: 'Welcome',
   *   html: '<p>Hello!</p>',
   * });
   * ```
   */
  async sendEmail(options: SendEmailOptions): Promise<EmailServiceResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
      });

      if (error) {
        console.error("Email sending error:", error);
        return {
          success: false,
          error: error.message || "Failed to send email",
        };
      }

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (error) {
      console.error("Email sending exception:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Send a welcome email to a new user
   *
   * @param email - User's email address
   * @param firstName - User's first name
   * @returns Result with success status
   *
   * @example
   * ```typescript
   * await emailService.sendWelcomeEmail('user@example.com', 'John');
   * ```
   */
  /**
   * Send a password reset email using React Email template
   *
   * @param email - User's email address
   * @param resetLink - Password reset link with token
   * @returns Result with success status
   *
   * @example
   * ```typescript
   * await emailService.sendPasswordResetEmail(
   *   'user@example.com',
   *   'https://app.com/reset-password?token=...'
   * );
   * ```
   */
  async sendPasswordResetEmail(email: string, resetLink: string): Promise<EmailServiceResult> {
    const html = await render(PasswordResetEmail({ resetLink, userEmail: email }));

    const text = `
Hi there,

We received a request to reset the password for your Ambra account (${email}).
Click the link below to set a new password:

${resetLink}

This link will expire in 1 hour for security reasons. If you didn't request a password reset, you can safely ignore this email.

Best regards,
The Ambra Team
    `;

    return this.sendEmail({
      to: email,
      subject: "Reset your Ambra password",
      html,
      text,
    });
  }

  /**
   * Send a welcome email to a new user using React Email template
   *
   * @param email - User's email address
   * @param firstName - User's first name
   * @returns Result with success status
   *
   * @example
   * ```typescript
   * await emailService.sendWelcomeEmailWithTemplate('user@example.com', 'John');
   * ```
   */
  async sendWelcomeEmailWithTemplate(
    email: string,
    firstName: string
  ): Promise<EmailServiceResult> {
    const loginLink = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/sign-in`;
    const html = await render(WelcomeEmailTemplate({ firstName, loginLink }));

    const text = `
Hi ${firstName},

Welcome to Ambra! We're excited to have you on board.

Your account has been created successfully, and you can now access all the features of our platform.

Get started: ${loginLink}

If you have any questions or need assistance, don't hesitate to reach out to our support team.

Best regards,
The Ambra Team
    `;

    return this.sendEmail({
      to: email,
      subject: "Welcome to Ambra!",
      html,
      text,
    });
  }

  /**
   * Send an invitation email using React Email template
   *
   * @param email - Invitee's email address
   * @param organizationName - Organization name
   * @param inviterName - Name of person who sent the invitation
   * @param invitationLink - Link to accept the invitation
   * @returns Result with success status
   *
   * @example
   * ```typescript
   * await emailService.sendInvitationEmailWithTemplate(
   *   'newuser@example.com',
   *   'Acme Corp',
   *   'John Doe',
   *   'https://app.com/accept-invite?token=...'
   * );
   * ```
   */
  async sendInvitationEmailWithTemplate(
    email: string,
    organizationName: string,
    inviterName: string,
    invitationLink: string
  ): Promise<EmailServiceResult> {
    const html = await render(
      InvitationEmailTemplate({ inviterName, organizationName, invitationLink })
    );

    const text = `
${inviterName} has invited you to join ${organizationName} on Ambra.

Click the link below to accept the invitation and create your account:
${invitationLink}

This invitation will expire in 7 days.

Best regards,
The Ambra Team
    `;

    return this.sendEmail({
      to: email,
      subject: `You've been invited to join ${organizationName}`,
      html,
      text,
    });
  }

  /**
   * Send a welcome email to a new user (legacy inline HTML version)
   *
   * @param email - User's email address
   * @param firstName - User's first name
   * @returns Result with success status
   *
   * @example
   * ```typescript
   * await emailService.sendWelcomeEmail('user@example.com', 'John');
   * ```
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<EmailServiceResult> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Ambra</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Ambra</h1>
          </div>
          <div style="background: #f9fafb; padding: 40px 20px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${firstName},</p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Welcome to Ambra! We're excited to have you on board.
            </p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your account has been created successfully, and you can now access all the features of our platform.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/sign-in" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Get Started
              </a>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you have any questions, feel free to reach out to our support team.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} Ambra. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Hi ${firstName},

Welcome to Ambra! We're excited to have you on board.

Your account has been created successfully, and you can now access all the features of our platform.

Get started: ${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/sign-in

If you have any questions, feel free to reach out to our support team.

© ${new Date().getFullYear()} Ambra. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: "Welcome to Ambra",
      html,
      text,
    });
  }

  /**
   * Send an invitation email to a new user
   *
   * @param email - Invitee's email address
   * @param organizationName - Organization name
   * @param inviterName - Name of person who sent the invitation
   * @param invitationLink - Link to accept the invitation
   * @returns Result with success status
   *
   * @example
   * ```typescript
   * await emailService.sendInvitationEmail(
   *   'newuser@example.com',
   *   'Acme Corp',
   *   'John Doe',
   *   'https://app.com/accept-invite?token=...'
   * );
   * ```
   */
  async sendInvitationEmail(
    email: string,
    organizationName: string,
    inviterName: string,
    invitationLink: string
  ): Promise<EmailServiceResult> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You've been invited to ${organizationName}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
          </div>
          <div style="background: #f9fafb; padding: 40px 20px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${inviterName} has invited you to join <strong>${organizationName}</strong> on Ambra.
            </p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Click the button below to accept the invitation and create your account.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Accept Invitation
              </a>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="font-size: 14px; color: #667eea; word-break: break-all;">${invitationLink}</p>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              This invitation will expire in 7 days.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} Ambra. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
${inviterName} has invited you to join ${organizationName} on Ambra.

Click the link below to accept the invitation and create your account:
${invitationLink}

This invitation will expire in 7 days.

© ${new Date().getFullYear()} Ambra. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: `You've been invited to join ${organizationName}`,
      html,
      text,
    });
  }
}
