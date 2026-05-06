import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://fitness.brightpathtechnology.io";

function escape(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInviteEmail(hostName: string, delegateEmail: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboard access from ${escape(hostName)}</title></head>
<body style="margin:0;padding:0;background:#0e0e0e;color:#ffffff;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 32px;">
    <div style="color:#C8FF00;font-family:Arial,sans-serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;margin-bottom:10px;">BrightPath Fitness</div>
    <h1 style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;color:#ffffff;margin:0 0 16px;line-height:1.2;">
      ${escape(hostName)} shared their dashboard with you
    </h1>
    <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
      ${escape(hostName)} has granted you read-only access to their BrightPath Fitness dashboard.
      Sign in (or create an account) at the link below — your delegated view will be ready automatically.
    </p>
    <a href="${APP_URL}" style="display:inline-block;background:#C8FF00;color:#0e0e0e;text-decoration:none;padding:13px 28px;font-family:Arial,sans-serif;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;border-radius:2px;">
      Open Dashboard →
    </a>
    <div style="margin-top:28px;padding:16px 20px;background:rgba(200,255,0,0.04);border:1px solid rgba(200,255,0,0.15);border-radius:2px;">
      <div style="color:rgba(255,255,255,0.4);font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">Your access</div>
      <div style="color:#fff;font-size:13px;">Read-only view of ${escape(hostName)}'s workouts, weight, food log, and goals.</div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:32px;padding-top:16px;">
      <p style="color:rgba(255,255,255,0.25);font-size:11px;line-height:1.8;margin:0;">
        This invitation was sent to ${escape(delegateEmail)} by ${escape(hostName)} via BrightPath Fitness.
        If you didn't expect this, you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let delegate_email: string, host_name: string;
  try {
    ({ delegate_email, host_name } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!delegate_email?.includes("@")) {
    return new Response(JSON.stringify({ error: "Valid delegate_email required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  const displayName = host_name || user.email?.split("@")[0] || "Someone";

  const html = renderInviteEmail(displayName, delegate_email);
  const subject = `${displayName} gave you access to their fitness dashboard`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [delegate_email], subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend error:", detail);
    return new Response(JSON.stringify({ error: "Failed to send email", detail }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ sent: true, recipient: delegate_email }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
