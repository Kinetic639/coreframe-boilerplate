import { Body, Button, Container, Head, Html, Link, Preview } from "@react-email/components";
import * as React from "react";

export interface NotificationEmailItem {
  /** "Marta Nowak przypisała Ci zgłoszenie" */
  sentence: string;
  /** Number of the object (HD-000014), if it has one */
  code: string | null;
  title: string;
  snippet: string | null;
  module: string;
  href: string | null;
}

interface NotificationsDigestEmailProps {
  preview: string;
  heading: string;
  greeting: string;
  intro: string;
  items: NotificationEmailItem[];
  openLabel: string;
  openAllLabel: string;
  allHref: string;
  settingsText: string;
  settingsHref: string;
  footer: string;
  siteUrl: string;
}

/** Unread notifications of one person in one organization, as one message */
export const NotificationsDigestEmail = ({
  preview,
  heading,
  greeting,
  intro,
  items,
  openLabel,
  openAllLabel,
  allHref,
  settingsText,
  settingsHref,
  footer,
  siteUrl,
}: NotificationsDigestEmailProps) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <table width="100%" cellPadding="0" cellSpacing="0">
          <tr>
            <td style={logoCell}>
              <Link href={siteUrl} style={logoLink}>
                <span style={logoAmbra}>Ambra</span>
                <span style={logoSystem}>system</span>
              </Link>
            </td>
          </tr>
          <tr>
            <td style={bodyCell}>
              <p style={heading1}>{heading}</p>
              <p style={bodyText}>
                {greeting} {intro}
              </p>
              {items.map((item, index) => (
                <div key={index} style={itemBox}>
                  <p style={itemSentence}>{item.sentence}</p>
                  <p style={itemTarget}>
                    {item.code ? <span style={itemCode}>{item.code}</span> : null}
                    {item.code && item.title ? " " : null}
                    {item.title}
                  </p>
                  {item.snippet ? <p style={itemSnippet}>{item.snippet}</p> : null}
                  <p style={itemMeta}>
                    {item.module}
                    {item.href ? (
                      <>
                        {" · "}
                        <Link href={item.href} style={itemLink}>
                          {openLabel}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              ))}
              <Button style={buttonStyle} href={allHref}>
                {openAllLabel}
              </Button>
            </td>
          </tr>
          <tr>
            <td style={disclaimerCell}>
              <p style={disclaimerText}>
                {settingsText}{" "}
                <Link href={settingsHref} style={itemLink}>
                  {settingsHref}
                </Link>
              </p>
            </td>
          </tr>
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

export default NotificationsDigestEmail;

const main = {
  margin: "0",
  padding: "0",
  backgroundColor: "#f3f4f6",
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif",
};
const wrapper = { maxWidth: "520px", margin: "0 auto", padding: "40px 20px" };
const logoCell = {
  backgroundColor: "#ffffff",
  padding: "24px 40px",
  borderRadius: "8px 8px 0 0",
  borderBottom: "1px solid #e9ecef",
};
const logoLink = { textDecoration: "none", display: "inline-flex", alignItems: "baseline" };
const logoAmbra = { color: "#F0A205", fontSize: "20px", fontWeight: "700" };
const logoSystem = { color: "#9ca3af", fontSize: "13px", fontWeight: "500", marginLeft: "2px" };
const bodyCell = { backgroundColor: "#ffffff", padding: "32px 40px 40px" };
const heading1 = { margin: "0 0 12px", color: "#111827", fontSize: "20px", fontWeight: "600" };
const bodyText = { margin: "0 0 20px", color: "#6b7280", fontSize: "15px", lineHeight: "1.6" };
const itemBox = {
  margin: "0 0 12px",
  padding: "12px 14px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
};
const itemSentence = { margin: "0 0 4px", color: "#111827", fontSize: "14px", fontWeight: "600" };
const itemTarget = { margin: "0", color: "#374151", fontSize: "13px" };
const itemCode = {
  fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
  backgroundColor: "#f3f4f6",
  padding: "1px 4px",
  borderRadius: "3px",
};
const itemSnippet = {
  margin: "8px 0 0",
  padding: "6px 10px",
  backgroundColor: "#f9fafb",
  borderLeft: "3px solid #e5e7eb",
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "1.5",
};
const itemMeta = { margin: "8px 0 0", color: "#9ca3af", fontSize: "12px" };
const itemLink = { color: "#b45309", textDecoration: "underline" };
const buttonStyle = {
  display: "inline-block",
  marginTop: "12px",
  padding: "12px 28px",
  backgroundColor: "#F0A205",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  textDecoration: "none",
  borderRadius: "6px",
};
const disclaimerCell = {
  backgroundColor: "#ffffff",
  padding: "0 40px 28px",
  borderRadius: "0 0 8px 8px",
};
const disclaimerText = { margin: "0", color: "#9ca3af", fontSize: "12px", lineHeight: "1.5" };
const copyrightCell = { padding: "20px 0 0", textAlign: "center" as const };
const copyrightText = { margin: "0", color: "#9ca3af", fontSize: "12px" };
