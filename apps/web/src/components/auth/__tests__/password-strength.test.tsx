import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PasswordStrength } from "../password-strength";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      label: "Password strength",
      weak: "Weak",
      fair: "Fair",
      good: "Good",
      strong: "Strong",
      "requirements.length": "At least 8 characters",
      "requirements.uppercase": "Uppercase letter (A-Z)",
      "requirements.lowercase": "Lowercase letter (a-z)",
      "requirements.number": "Number (0-9)",
    };
    return translations[key] || key;
  },
}));

describe("PasswordStrength", () => {
  describe("strength meter display", () => {
    it("should show empty bars for empty password", () => {
      const { container } = render(<PasswordStrength password="" />);
      const bars = container.querySelectorAll(".h-2");

      expect(bars).toHaveLength(4);
      bars.forEach((bar) => {
        expect(bar.className).toContain("bg-muted");
      });
    });

    it("should show weak (1 bar) for password with only lowercase short", () => {
      // Only lowercase, < 8 chars = 1/4 requirements
      render(<PasswordStrength password="abcdef" />);

      expect(screen.getByText("Weak")).toBeInTheDocument();
    });

    it("should show fair (2 bars) for password with lowercase and uppercase but short", () => {
      // Has lowercase and uppercase, but < 8 chars, no number = 2/4 requirements
      render(<PasswordStrength password="Abcdef" />);

      expect(screen.getByText("Fair")).toBeInTheDocument();
    });

    it("should show good (3 bars) for password with lowercase, uppercase, and number but short", () => {
      // Has lowercase, uppercase, and number but < 8 chars = 3/4 requirements
      render(<PasswordStrength password="Abcde1" />);

      expect(screen.getByText("Good")).toBeInTheDocument();
    });

    it("should show strong (4 bars) for password meeting all requirements", () => {
      // Has all: length (8+), uppercase, lowercase, number = 4/4 requirements
      render(<PasswordStrength password="Abcdefg1" />);

      expect(screen.getByText("Strong")).toBeInTheDocument();
    });
  });

  describe("requirements checklist", () => {
    it("should show all requirements as unmet for empty password", () => {
      render(<PasswordStrength password="" />);

      expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
      expect(screen.getByText("Uppercase letter (A-Z)")).toBeInTheDocument();
      expect(screen.getByText("Lowercase letter (a-z)")).toBeInTheDocument();
      expect(screen.getByText("Number (0-9)")).toBeInTheDocument();
    });

    it("should mark length requirement as met for 8+ character password", () => {
      render(<PasswordStrength password="abcdefgh" />);

      const requirement = screen.getByText("At least 8 characters").closest("li");
      expect(requirement?.className).toContain("text-green");
    });

    it("should mark uppercase requirement as met", () => {
      render(<PasswordStrength password="Abcd" />);

      const requirement = screen.getByText("Uppercase letter (A-Z)").closest("li");
      expect(requirement?.className).toContain("text-green");
    });

    it("should mark lowercase requirement as met", () => {
      render(<PasswordStrength password="abcd" />);

      const requirement = screen.getByText("Lowercase letter (a-z)").closest("li");
      expect(requirement?.className).toContain("text-green");
    });

    it("should mark number requirement as met", () => {
      render(<PasswordStrength password="123" />);

      const requirement = screen.getByText("Number (0-9)").closest("li");
      expect(requirement?.className).toContain("text-green");
    });

    it("should mark all requirements as met for strong password", () => {
      render(<PasswordStrength password="Password123" />);

      const lengthReq = screen.getByText("At least 8 characters").closest("li");
      const uppercaseReq = screen.getByText("Uppercase letter (A-Z)").closest("li");
      const lowercaseReq = screen.getByText("Lowercase letter (a-z)").closest("li");
      const numberReq = screen.getByText("Number (0-9)").closest("li");

      expect(lengthReq?.className).toContain("text-green");
      expect(uppercaseReq?.className).toContain("text-green");
      expect(lowercaseReq?.className).toContain("text-green");
      expect(numberReq?.className).toContain("text-green");
    });
  });

  describe("edge cases", () => {
    it("should handle exactly 8 characters", () => {
      render(<PasswordStrength password="Abcdef12" />);

      const lengthReq = screen.getByText("At least 8 characters").closest("li");
      expect(lengthReq?.className).toContain("text-green");
    });

    it("should handle 7 characters (not meeting length)", () => {
      render(<PasswordStrength password="Abcde12" />);

      const lengthReq = screen.getByText("At least 8 characters").closest("li");
      expect(lengthReq?.className).not.toContain("text-green");
    });

    it("should handle multiple uppercase letters", () => {
      render(<PasswordStrength password="ABC" />);

      const uppercaseReq = screen.getByText("Uppercase letter (A-Z)").closest("li");
      expect(uppercaseReq?.className).toContain("text-green");
    });

    it("should handle multiple numbers", () => {
      render(<PasswordStrength password="123456" />);

      const numberReq = screen.getByText("Number (0-9)").closest("li");
      expect(numberReq?.className).toContain("text-green");
    });

    it("should handle special characters (not counted as requirement)", () => {
      render(<PasswordStrength password="Password123!@#" />);

      // All requirements should still be met
      expect(screen.getByText("Strong")).toBeInTheDocument();
    });
  });

  describe("visual feedback", () => {
    it("should show dash when no password is entered", () => {
      render(<PasswordStrength password="" />);

      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("should not show dash when password is entered", () => {
      render(<PasswordStrength password="abc" />);

      expect(screen.queryByText("—")).not.toBeInTheDocument();
    });

    it("should display strength label", () => {
      render(<PasswordStrength password="" />);

      expect(screen.getByText("Password strength:")).toBeInTheDocument();
    });
  });
});
