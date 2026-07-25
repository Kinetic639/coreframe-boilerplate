import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
} from "@react-email/components";
import * as React from "react";

interface InvitationEmailProps {
  heading: string;
  body: string;
  button: string;
  linkLabel: string;
  disclaimer: string;
  footer: string;
  preview: string;
  invitationLink: string;
  siteUrl?: string;
}

export const InvitationEmail = ({
  heading,
  body,
  button: buttonText,
  linkLabel,
  disclaimer,
  footer,
  preview,
  invitationLink,
  siteUrl = "https://ambra-system.com",
}: InvitationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={wrapper}>
          <table width="100%" cellPadding="0" cellSpacing="0">
            {/* Logo header */}
            <tr>
              <td style={logoCell}>
                <Link href={siteUrl} style={logoLink}>
                  <span style={logoAmbra}>Ambra</span>
                  <span style={logoSystem}>system</span>
                </Link>
              </td>
            </tr>

            {/* Body */}
            <tr>
              <td style={bodyCell}>
                <p style={heading1}>{heading}</p>
                <p style={bodyText}>{body}</p>
                <Section style={buttonSection}>
                  <Button style={buttonStyle} href={invitationLink}>
                    {buttonText}
                  </Button>
                </Section>
                <p style={linkLabelText}>{linkLabel}</p>
                <p style={linkText}>
                  <Link href={invitationLink} style={linkAnchor}>
                    {invitationLink}
                  </Link>
                </p>
              </td>
            </tr>

            {/* Disclaimer footer */}
            <tr>
              <td style={disclaimerCell}>
                <p style={disclaimerText}>{disclaimer}</p>
              </td>
            </tr>

            {/* Copyright */}
            <tr>
              <td style={copyrightCell}>
                <p style={copyrightText}>{footer}</p>
              </td>
            </tr>
          </table>
        </Container>
      </Body>
    </Html>
  );
};

export default InvitationEmail;

const main = {
  margin: "0",
  padding: "0",
  backgroundColor: "#f3f4f6",
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif",
};

const wrapper = {
  maxWidth: "520px",
  margin: "0 auto",
  padding: "40px 20px",
};

const logoCell = {
  backgroundColor: "#ffffff",
  padding: "24px 40px",
  borderRadius: "8px 8px 0 0",
  borderBottom: "1px solid #e9ecef",
};

const logoLink = {
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "baseline",
};

const logoAmbra = {
  color: "#F0A205",
  fontSize: "20px",
  fontWeight: "700",
};

const logoSystem = {
  color: "#9ca3af",
  fontSize: "13px",
  fontWeight: "500",
  marginLeft: "2px",
};

const bodyCell = {
  backgroundColor: "#ffffff",
  padding: "40px 40px 48px",
};

const heading1 = {
  margin: "0 0 12px",
  color: "#111827",
  fontSize: "20px",
  fontWeight: "600",
  letterSpacing: "-0.3px",
};

const bodyText = {
  margin: "0 0 28px",
  color: "#6b7280",
  fontSize: "15px",
  lineHeight: "1.6",
};

const buttonSection = {
  marginBottom: "28px",
};

const buttonStyle = {
  display: "inline-block",
  padding: "12px 28px",
  backgroundColor: "#F0A205",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  textDecoration: "none",
  borderRadius: "6px",
};

const linkLabelText = {
  margin: "0 0 6px",
  color: "#9ca3af",
  fontSize: "12px",
};

const linkText = {
  margin: "0",
  fontSize: "12px",
  wordBreak: "break-all" as const,
};

const linkAnchor = {
  color: "#F0A205",
  textDecoration: "none",
};

const disclaimerCell = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e9ecef",
  borderTop: "none",
  borderRadius: "0 0 8px 8px",
  padding: "16px 40px",
};

const disclaimerText = {
  margin: "0",
  color: "#d1d5db",
  fontSize: "12px",
};

const copyrightCell = {
  padding: "20px 0",
  textAlign: "center" as const,
};

const copyrightText = {
  margin: "0",
  color: "#d1d5db",
  fontSize: "12px",
};
