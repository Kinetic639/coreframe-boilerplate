import { EmailTemplate } from "@/components/emails/test";
import { Resend } from "resend";

export async function POST() {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const reactElement = EmailTemplate({ firstName: "John" });
    const { data, error } = await resend.emails.send({
      from: "Acme <onboarding@resend.dev>",
      to: "supabase.dev@gmail.com",
      subject: "Hello world",
      react: await reactElement,
    });
    if (error) {
      console.error("Resend error:", error);
      return Response.json({ error }, { status: 500 });
    }
    return Response.json(data);
  } catch (error) {
    console.error("Catch error:", error);
    return Response.json({ error }, { status: 500 });
  }
}
