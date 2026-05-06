import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FoodRow = {
  date: string;
  meal: string | null;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number | null;
  notes: string | null;
};

function escape(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEmail({
  title,
  subtitle,
  rows,
  displayName,
  appUrl,
}: {
  title: string;
  subtitle: string;
  rows: FoodRow[];
  displayName: string;
  appUrl: string;
}) {
  const totals = rows.reduce(
    (a, r) => ({
      calories: a.calories + Number(r.calories || 0),
      protein_g: a.protein_g + Number(r.protein_g || 0),
      carbs_g: a.carbs_g + Number(r.carbs_g || 0),
      fat_g: a.fat_g + Number(r.fat_g || 0),
      fibre_g: a.fibre_g + Number(r.fibre_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 },
  );

  const byDateMeal: Record<string, Record<string, FoodRow[]>> = {};
  for (const r of rows) {
    const m = r.meal || "snack";
    byDateMeal[r.date] ??= {};
    byDateMeal[r.date][m] ??= [];
    byDateMeal[r.date][m].push(r);
  }
  const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

  const dateSections = Object.keys(byDateMeal)
    .sort()
    .map((date) => {
      const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      const mealSections = MEAL_ORDER.filter((m) => byDateMeal[date][m])
        .map((m) => {
          const items = byDateMeal[date][m]
            .map(
              (r) => `
                <tr>
                  <td style="padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="color:#fff;font-size:14px;">${escape(r.name)}
                      <span style="color:rgba(255,255,255,0.4);font-size:12px;">&nbsp;${r.quantity} ${escape(r.unit)}</span>
                    </div>
                    ${r.notes ? `<div style="color:rgba(255,255,255,0.35);font-size:11px;font-style:italic;">${escape(r.notes)}</div>` : ""}
                  </td>
                  <td style="padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;color:#C8FF00;font-size:13px;white-space:nowrap;">${Math.round(r.calories)} kcal</td>
                  <td style="padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;color:rgba(255,255,255,0.55);font-size:12px;white-space:nowrap;">P ${Math.round(r.protein_g)} · C ${Math.round(r.carbs_g)} · F ${Math.round(r.fat_g)}</td>
                </tr>`,
            )
            .join("");
          return `
            <div style="margin-top:16px;">
              <div style="color:rgba(255,255,255,0.4);font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;">${m}</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${items}
              </table>
            </div>`;
        })
        .join("");

      return `
        <div style="margin-bottom:20px;">
          <div style="color:#fff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;margin-bottom:4px;">${dateLabel}</div>
          ${mealSections}
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#0e0e0e;color:#ffffff;font-family:Georgia,serif;">
  <div style="max-width:620px;margin:0 auto;padding:40px 28px;">
    <div style="color:#C8FF00;font-family:Arial,sans-serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;margin-bottom:10px;">BrightPath Fitness · Food Export</div>
    <h1 style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;color:#ffffff;margin:0 0 6px;line-height:1.2;">${escape(title)}</h1>
    <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:24px;">${escape(subtitle)} · ${escape(displayName)}</div>

    <div style="background:rgba(200,255,0,0.04);border:1px solid rgba(200,255,0,0.2);border-radius:4px;padding:16px 20px;margin-bottom:24px;">
      <div style="color:rgba(255,255,255,0.4);font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">Totals</div>
      <div style="display:flex;flex-wrap:wrap;gap:18px;">
        <div><span style="color:#C8FF00;font-family:Arial,sans-serif;font-size:22px;font-weight:700;">${Math.round(totals.calories)}</span> <span style="color:rgba(255,255,255,0.4);font-size:12px;">kcal</span></div>
        <div style="color:rgba(255,255,255,0.75);font-size:13px;">P ${Math.round(totals.protein_g)}g · C ${Math.round(totals.carbs_g)}g · F ${Math.round(totals.fat_g)}g${totals.fibre_g > 0 ? ` · Fibre ${Math.round(totals.fibre_g)}g` : ""}</div>
      </div>
    </div>

    ${rows.length ? dateSections : `<div style="color:rgba(255,255,255,0.4);font-size:14px;padding:20px 0;">No food entries logged for this period.</div>`}

    <div style="margin-top:24px;">
      <a href="${appUrl}" style="display:inline-block;background:#C8FF00;color:#0e0e0e;text-decoration:none;padding:11px 24px;font-family:Arial,sans-serif;font-weight:700;font-size:11px;letter-spacing:2px;text-transform:uppercase;border-radius:2px;">Open Dashboard →</a>
    </div>

    <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:32px;padding-top:16px;">
      <p style="color:rgba(255,255,255,0.25);font-size:11px;line-height:1.8;margin:0;">
        Sent on demand from BrightPath Fitness.
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
    return new Response(
      JSON.stringify({ error: "Unauthorized", detail: authErr?.message }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let days: number, end_date: string, email: string | undefined;
  try {
    ({ days, end_date, email } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!days || ![1, 7, 30].includes(days)) {
    return new Response(JSON.stringify({ error: "days must be 1, 7, or 30" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!end_date || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
    return new Response(JSON.stringify({ error: "end_date must be YYYY-MM-DD" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const recipient = email?.trim() || user.email;
  if (!recipient || !recipient.includes("@")) {
    return new Response(JSON.stringify({ error: "No valid recipient email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const endDate = new Date(end_date + "T00:00:00");
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  const start_date = startDate.toISOString().slice(0, 10);

  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("APP_SERVICE_ROLE_KEY")!,
  );

  const { data: profileData } = await serviceSupabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();
  const displayName = profileData?.name || user.email?.split("@")[0] || "You";

  const { data: rows, error: queryErr } = await serviceSupabase
    .from("food_log")
    .select("date, meal, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fibre_g, notes")
    .eq("user_id", user.id)
    .gte("date", start_date)
    .lte("date", end_date)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (queryErr) {
    return new Response(JSON.stringify({ error: queryErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const foodRows = (rows ?? []) as FoodRow[];

  const rangeLabel =
    days === 1
      ? new Date(end_date + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : `${start_date} to ${end_date}`;

  const subtitle = days === 1 ? "Daily summary" : days === 7 ? "Weekly summary" : "Monthly summary";
  const subject =
    days === 1
      ? `${displayName}'s food log — ${end_date}`
      : `${displayName}'s food log — ${start_date} to ${end_date}`;

  const html = renderEmail({
    title: `Food log — ${rangeLabel}`,
    subtitle,
    rows: foodRows,
    displayName,
    appUrl: "https://fitness.brightpathtechnology.io",
  });

  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [recipient], subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend error:", detail);
    return new Response(JSON.stringify({ error: "Failed to send email", detail }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ sent: true, recipient, entry_count: foodRows.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
