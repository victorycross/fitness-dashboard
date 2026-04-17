import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const TZ = "America/Toronto";

// Return YYYY-MM-DD in the given IANA timezone at the given instant.
function dateInTZ(d: Date, tz: string): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}

// Day of week 0-6 (Sun-Sat) in the given IANA timezone.
function dowInTZ(d: Date, tz: string): number {
  const w = d.toLocaleDateString("en-US", { timeZone: tz, weekday: "short" });
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(w);
}

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
      const dateLabel = new Date(date + "T00:00:00").toLocaleDateString(
        "en-US",
        { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" },
      );
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
        You're receiving this because ${escape(displayName)} added your address to their food export list in BrightPath Fitness. To stop receiving these, ask the sender to remove your address from the Profile → Food Exports settings.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function escape(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("APP_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  const appUrl = "https://fitness.brightpathtechnology.io";

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  const todayLocal = dateInTZ(now, TZ);
  const isSunday = dowInTZ(now, TZ) === 0;

  const weekStartLocal = (() => {
    const sinceUtc = new Date(now.getTime() - 6 * 86400000);
    return dateInTZ(sinceUtc, TZ);
  })();

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, name, food_export_emails, food_export_daily, food_export_weekly")
    .or("food_export_daily.eq.true,food_export_weekly.eq.true");

  if (profErr) {
    return new Response(JSON.stringify({ error: profErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sentDaily = 0;
  let sentWeekly = 0;

  for (const p of profiles ?? []) {
    const recipients: string[] = (p.food_export_emails ?? []).filter(Boolean);
    if (recipients.length === 0) continue;

    const displayName = p.name || "Your friend";

    // ── Daily ──
    if (p.food_export_daily) {
      const { data: rows } = await supabase
        .from("food_log")
        .select("date, meal, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fibre_g, notes, created_at")
        .eq("user_id", p.id)
        .eq("date", todayLocal)
        .order("created_at", { ascending: true });

      const dailyRows = (rows ?? []) as FoodRow[];
      const html = renderEmail({
        title: `Food log — ${new Date(todayLocal + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}`,
        subtitle: "Daily summary",
        rows: dailyRows,
        displayName,
        appUrl,
      });
      const subject = `${displayName}'s food log — ${todayLocal}`;
      const ok = await sendResend(resendApiKey, fromEmail, recipients, subject, html);
      if (ok) sentDaily++;
    }

    // ── Weekly (Sundays only) ──
    if (p.food_export_weekly && isSunday) {
      const { data: rows } = await supabase
        .from("food_log")
        .select("date, meal, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fibre_g, notes, created_at")
        .eq("user_id", p.id)
        .gte("date", weekStartLocal)
        .lte("date", todayLocal)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });

      const weekRows = (rows ?? []) as FoodRow[];
      const html = renderEmail({
        title: `Weekly food log`,
        subtitle: `${weekStartLocal} → ${todayLocal}`,
        rows: weekRows,
        displayName,
        appUrl,
      });
      const subject = `${displayName}'s weekly food log — ${weekStartLocal} to ${todayLocal}`;
      const ok = await sendResend(resendApiKey, fromEmail, recipients, subject, html);
      if (ok) sentWeekly++;
    }
  }

  return new Response(JSON.stringify({ sent_daily: sentDaily, sent_weekly: sentWeekly, is_sunday: isSunday }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function sendResend(apiKey: string, from: string, to: string[], subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error("Resend error:", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend exception:", err);
    return false;
  }
}
