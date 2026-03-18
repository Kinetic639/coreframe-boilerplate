/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Resend before importing EmailService
const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: mockSend,
    };
  },
}));

// Import after mock
import { EmailService } from "../email.service";

describe("EmailService", () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.RESEND_FROM_EMAIL = "test@coreframe.app";
    process.env.RESEND_FROM_NAME = "Test Coreframe";

    // Create new instance for each test
    emailService = new EmailService();
  });

  describe("constructor", () => {
    it("should throw error if RESEND_API_KEY is not set", () => {
      delete process.env.RESEND_API_KEY;

      expect(() => {
        new EmailService();
      }).toThrow("RESEND_API_KEY environment variable is not set");
    });

    it("should use default values if RESEND_FROM_EMAIL and RESEND_FROM_NAME are not set", () => {
      delete process.env.RESEND_FROM_EMAIL;
      delete process.env.RESEND_FROM_NAME;
      process.env.RESEND_API_KEY = "test-key";

      expect(() => {
        new EmailService();
      }).not.toThrow();
    });
  });

  describe("sendEmail", () => {
    it("should successfully send email", async () => {
      mockSend.mockResolvedValue({
        data: { id: "test-message-id" },
        error: null,
      });

      const result = await emailService.sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("test-message-id");
      expect(result.error).toBeUndefined();

      expect(mockSend).toHaveBeenCalledWith({
        from: "Test Coreframe <test@coreframe.app>",
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
        text: undefined,
        replyTo: undefined,
        cc: undefined,
        bcc: undefined,
      });
    });

    it("should handle email sending errors from Resend", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Invalid email address" },
      });

      const result = await emailService.sendEmail({
        to: "invalid-email",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid email address");
      expect(result.messageId).toBeUndefined();
    });

    it("should handle exceptions during email sending", async () => {
      mockSend.mockRejectedValue(new Error("Network error"));

      const result = await emailService.sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should send email with all options", async () => {
      mockSend.mockResolvedValue({
        data: { id: "test-id" },
        error: null,
      });

      await emailService.sendEmail({
        to: ["user1@example.com", "user2@example.com"],
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
        replyTo: "reply@example.com",
        cc: "cc@example.com",
        bcc: "bcc@example.com",
      });

      expect(mockSend).toHaveBeenCalledWith({
        from: "Test Coreframe <test@coreframe.app>",
        to: ["user1@example.com", "user2@example.com"],
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
        replyTo: "reply@example.com",
        cc: "cc@example.com",
        bcc: "bcc@example.com",
      });
    });
  });

  describe("sendWelcomeEmail", () => {
    it("should send welcome email with correct content", async () => {
      mockSend.mockResolvedValue({
        data: { id: "welcome-id" },
        error: null,
      });

      const result = await emailService.sendWelcomeEmail("user@example.com", "John");

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalled();

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.to).toBe("user@example.com");
      expect(callArgs.subject).toBe("Welcome to Ambra");
      expect(callArgs.html).toContain("Hi John");
      expect(callArgs.html).toContain("Welcome to Ambra");
      expect(callArgs.text).toContain("Hi John");
    });

    it("should handle errors in welcome email", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Send failed" },
      });

      const result = await emailService.sendWelcomeEmail("user@example.com", "John");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Send failed");
    });
  });

  describe("sendInvitationEmail", () => {
    it("should send invitation email with correct content", async () => {
      mockSend.mockResolvedValue({
        data: { id: "invitation-id" },
        error: null,
      });

      const result = await emailService.sendInvitationEmail(
        "newuser@example.com",
        "Acme Corp",
        "John Doe",
        "https://app.com/invite?token=abc123"
      );

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalled();

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.to).toBe("newuser@example.com");
      expect(callArgs.subject).toBe("You've been invited to join Acme Corp");
      expect(callArgs.html).toContain("John Doe");
      expect(callArgs.html).toContain("Acme Corp");
      expect(callArgs.html).toContain("https://app.com/invite?token=abc123");
      expect(callArgs.text).toContain("John Doe");
      expect(callArgs.text).toContain("Acme Corp");
    });

    it("should handle errors in invitation email", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Send failed" },
      });

      const result = await emailService.sendInvitationEmail(
        "user@example.com",
        "Org",
        "Inviter",
        "https://link.com"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Send failed");
    });
  });
});
