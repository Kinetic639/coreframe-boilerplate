import { EmailTemplate } from "@/components/emails/test";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  console.log("POST /api/send called");
  try {
    const reactElement = EmailTemplate({ firstName: "John" });
    console.log("EmailTemplate output:", reactElement);
    const { data, error } = await resend.emails.send({
      from: "Acme <onboarding@resend.dev>",
      to: "supabase.dev@gmail.com",
      subject: "Hello world",
      react: await reactElement,
    });
    console.log("Resend response:", { data, error });
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
