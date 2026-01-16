import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface InvitationEmailProps {
  inviterName: string;
  organizationName: string;
  invitationLink: string;
}

export const InvitationEmail = ({
  inviterName = "A team member",
  organizationName = "their organization",
  invitationLink,
}: InvitationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>You've been invited to join {organizationName} on Coreframe</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You're invited!</Heading>

          <Text style={text}>
            {inviterName} has invited you to join <strong>{organizationName}</strong> on Coreframe.
          </Text>

          <Text style={text}>
            Click the button below to accept the invitation and create your account.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={invitationLink}>
              Accept Invitation
            </Button>
          </Section>

          <Text style={footer}>
            If the button doesn't work, copy and paste this link into your browser:
          </Text>

          <Text style={link}>{invitationLink}</Text>

          <Text style={footer}>This invitation will expire in 7 days.</Text>

          <Text style={footer}>
            Best regards,
            <br />
            The Coreframe Team
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default InvitationEmail;

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const h1 = {
  color: "#333",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0",
  textAlign: "center" as const,
};

const text = {
  color: "#333",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: "14px",
  lineHeight: "24px",
  padding: "0 40px",
};

const buttonContainer = {
  padding: "27px 0 27px",
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#5469d4",
  borderRadius: "5px",
  color: "#fff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  width: "200px",
  padding: "14px 7px",
};

const link = {
  color: "#5469d4",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: "12px",
  lineHeight: "16px",
  padding: "0 40px",
  wordBreak: "break-all" as const,
};

const footer = {
  color: "#898989",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  fontSize: "12px",
  lineHeight: "16px",
  padding: "0 40px",
  marginTop: "24px",
};
