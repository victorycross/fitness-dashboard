import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  // Verify the requesting user is logged in
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    console.error("auth.getUser failed:", authErr?.message, authErr?.status);
    return new Response(
      JSON.stringify({ error: "Unauthorized", detail: authErr?.message ?? "no user returned" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let friend_email: string, inviter_name: string, invite_code: string;
  try {
    ({ friend_email, inviter_name, invite_code } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!friend_email || !friend_email.includes("@")) {
    return new Response(JSON.stringify({ error: "Valid friend_email required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail    = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  const appUrl       = "https://fitness.brightpathtechnology.io";
  const firstName    = inviter_name?.split(" ")[0] || "A member";
  const codeBlock    = invite_code ? invite_code.trim().toUpperCase() : "BETA2026";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're invited to BrightPath Fitness</title></head>
<body style="margin:0;padding:0;background:#0e0e0e;color:#ffffff;font-family:Georgia,serif;">
  <div style="max-width:540px;margin:0 auto;padding:48px 32px;">
    <div style="color:#C8FF00;font-family:Arial,sans-serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;margin-bottom:10px;">BrightPath Fitness</div>
    <h1 style="font-family:Arial,sans-serif;font-size:30px;font-weight:900;color:#ffffff;margin:0 0 28px;line-height:1.15;">You've been invited 👋</h1>

    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:30px 32px;margin-bottom:28px;">
      <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.8;margin:0 0 18px;">
        <strong style="color:#fff;">${firstName}</strong> has invited you to join <strong style="color:#fff;">BrightPath Fitness</strong> — a private training dashboard for logging workouts, tracking your weight, and building a program designed entirely around your goals.
      </p>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.8;margin:0 0 20px;">
        Currently in closed beta. Use the invite code below when you create your account.
      </p>
      <div style="background:rgba(200,255,0,0.08);border:1px solid rgba(200,255,0,0.25);border-radius:4px;padding:16px 24px;margin-bottom:24px;text-align:center;">
        <div style="color:rgba(255,255,255,0.5);font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">Your invite code</div>
        <div style="color:#C8FF00;font-family:Arial,sans-serif;font-size:28px;font-weight:900;letter-spacing:6px;">${codeBlock}</div>
      </div>
      <a href="${appUrl}" style="display:inline-block;background:#C8FF00;color:#0e0e0e;text-decoration:none;padding:13px 30px;font-family:Arial,sans-serif;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;border-radius:2px;">Create My Account →</a>
    </div>

    <div style="margin-bottom:28px;padding:20px 24px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:4px;">
      <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.8;margin:0 0 12px;font-weight:bold;color:rgba(255,255,255,0.7);">What you get:</p>
      <ul style="color:rgba(255,255,255,0.5);font-size:13px;line-height:2;margin:0;padding-left:18px;">
        <li>AI workout parser — log sessions from text or a photo</li>
        <li>Weight &amp; BMI tracking with progress charts</li>
        <li>Custom program design — your locations, targets, and goals</li>
        <li>Progress photos and weekly training history</li>
        <li>Optional email reminders when your log falls behind</li>
      </ul>
    </div>

    <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
      <p style="color:rgba(255,255,255,0.25);font-size:12px;line-height:1.8;margin:0;">
        Your data stays yours — no ads, no third-party sharing, PIPEDA compliant. Delete your account anytime.<br><br>
        If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: friend_email,
      subject: `${firstName} invited you to BrightPath Fitness`,
      html,
    }),
  });

  if (!res.ok) {
    console.error("Resend error:", await res.text());
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
