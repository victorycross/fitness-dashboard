/**
 * DashboardTab — consolidated metrics landing page.
 * Reads food_log + food_day_status itself; gets sessions/weights/profile via props.
 */
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { localDateStr } from "./utils/date.js";
import { kgToLbs, formatWeight } from "./utils/units.js";

const ACCENT = "#C8FF00";
const DIM = "rgba(255,255,255,0.4)";

function Card({ children, accent }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${accent || "rgba(255,255,255,0.08)"}`,
      borderRadius: 2,
      padding: "20px 24px",
      flex: 1,
      minWidth: 180,
    }}>
      {children}
    </div>
  );
}

function Label({ children, accent }) {
  return (
    <div style={{
      color: accent || ACCENT,
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 12,
      letterSpacing: 3,
      textTransform: "uppercase",
      marginBottom: 8,
    }}>{children}</div>
  );
}

function BigValue({ children, accent }) {
  return (
    <div style={{
      color: accent || "#fff",
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 40,
      fontWeight: 700,
      lineHeight: 1,
    }}>{children}</div>
  );
}

function Sub({ children }) {
  return (
    <div style={{ color: DIM, fontSize: 12, marginTop: 6, fontStyle: "italic" }}>{children}</div>
  );
}

export default function DashboardTab({ supabase, user, profile, sessions, weights, viewingUserId, isReadOnly }) {
  const [todayFood, setTodayFood] = useState(null);
  const [weekCalories, setWeekCalories] = useState([]);
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = localDateStr();
  const targetUserId = viewingUserId || user.id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 6);
      const sinceStr = localDateStr(since);

      const [foodRes, statusRes] = await Promise.all([
        supabase.from("food_log")
          .select("date, calories, protein_g, carbs_g, fat_g")
          .eq("user_id", targetUserId)
          .gte("date", sinceStr),
        supabase.from("food_day_status")
          .select("date")
          .eq("user_id", targetUserId)
          .eq("date", today)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      const rows = foodRes.data || [];
      const todayRows = rows.filter(r => r.date === today);
      setTodayFood(todayRows.reduce(
        (a, r) => ({
          calories: a.calories + Number(r.calories),
          protein_g: a.protein_g + Number(r.protein_g),
          carbs_g: a.carbs_g + Number(r.carbs_g),
          fat_g: a.fat_g + Number(r.fat_g),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      ));

      const byDate = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = localDateStr(d);
        byDate[k] = { date: k, calories: 0, label: d.toLocaleDateString("en-US", { weekday: "short" }) };
      }
      rows.forEach(r => {
        if (byDate[r.date]) byDate[r.date].calories += Number(r.calories);
      });
      setWeekCalories(Object.values(byDate));

      setFinalized(!!statusRes.data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase, today, targetUserId]);

  // ── Weight metrics (from props) ──
  const heightM = profile?.height_cm ? parseFloat(profile.height_cm) / 100 : null;
  const targetBMI = profile?.target_bmi ? parseFloat(profile.target_bmi) : 24.9;
  const targetKg = heightM ? +(targetBMI * heightM * heightM).toFixed(1) : null;
  const sortedW = [...weights].sort((a, b) => a.date > b.date ? 1 : -1);
  const latestW = sortedW[sortedW.length - 1];
  const weekAgoIdx = sortedW.findIndex(w => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return w.date >= localDateStr(cutoff);
  });
  const weightWeekChange = latestW && weekAgoIdx > 0
    ? +(latestW.kg - sortedW[weekAgoIdx - 1].kg).toFixed(1)
    : null;

  // ── Weekly workout metrics ──
  const weekStart = (() => {
    const d = new Date(); const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return localDateStr(d);
  })();
  const weekSessions = sessions.filter(s => s.date >= weekStart);
  const weekSessionTarget = profile?.weekly_sessions_target || 3;
  const weekCalTarget = profile?.weekly_cal_target || 1500;
  const weekBurnedCals = weekSessions.reduce((a, s) => a + (s.calories_est || 0), 0);
  const lastSession = sessions[0];

  // ── Toggle finalized ──
  async function toggleFinalized() {
    if (finalized) {
      await supabase.from("food_day_status").delete().eq("date", today);
      setFinalized(false);
    } else {
      await supabase.from("food_day_status").insert({ user_id: user.id, date: today });
      setFinalized(true);
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", color: DIM, padding: 40 }}>Loading…</div>;
  }

  const displayName = profile?.name || user.email.split("@")[0];
  const caloriesToday = todayFood?.calories || 0;

  return (
    <div>
      {/* ── Header greeting ─────────────────────────────────── */}
      <div style={{ marginTop: 32, marginBottom: 24 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, letterSpacing: 1 }}>
          Hi {displayName.split(" ")[0]}
        </div>
        <div style={{ color: DIM, fontSize: 14, marginTop: 4 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          {finalized && <span style={{ color: ACCENT, marginLeft: 12, fontWeight: 600 }}>· Food logged ✓</span>}
        </div>
      </div>

      {/* ── Row 1: Food today + macros ──────────────────────── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <Card>
          <Label>Calories Today</Label>
          <BigValue accent={ACCENT}>{caloriesToday}</BigValue>
          <Sub>{todayFood?.protein_g ? `P ${Math.round(todayFood.protein_g)}g · C ${Math.round(todayFood.carbs_g)}g · F ${Math.round(todayFood.fat_g)}g` : "Nothing logged yet"}</Sub>
        </Card>
        <Card>
          <Label>Protein Today</Label>
          <BigValue>{Math.round(todayFood?.protein_g || 0)}<span style={{ fontSize: 18, color: DIM, marginLeft: 4 }}>g</span></BigValue>
          <Sub>carbs {Math.round(todayFood?.carbs_g || 0)}g · fat {Math.round(todayFood?.fat_g || 0)}g</Sub>
        </Card>
        <Card>
          <Label accent={finalized ? ACCENT : "rgba(255,255,255,0.5)"}>Day Status</Label>
          <button
            onClick={toggleFinalized}
            style={{
              background: finalized ? ACCENT : "transparent",
              color: finalized ? "#0e0e0e" : ACCENT,
              border: `1px solid ${ACCENT}`,
              borderRadius: 2,
              padding: "10px 18px",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 2,
              textTransform: "uppercase",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            {finalized ? "✓ Finished — Reopen" : "Finish for today"}
          </button>
        </Card>
      </div>

      {/* ── Row 2: Weight + workouts ────────────────────────── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <Card>
          <Label>Current Weight</Label>
          <BigValue>{latestW?.kg ? latestW.kg.toFixed(1) : "—"}<span style={{ fontSize: 18, color: DIM, marginLeft: 4 }}>kg</span></BigValue>
          <Sub>
            {latestW ? <span>{kgToLbs(latestW.kg).toFixed(0)} lb</span> : null}
            {targetKg && latestW ? (
              <span style={{ marginLeft: 8 }}>
                {latestW.kg > targetKg
                  ? `· ${formatWeight(latestW.kg - targetKg)} to target`
                  : `· at or below target (${formatWeight(targetKg)})`}
              </span>
            ) : !latestW ? "no weight logged" : null}
            {weightWeekChange !== null && (
              <span style={{ marginLeft: 8, color: weightWeekChange < 0 ? ACCENT : "#facc15" }}>
                · {weightWeekChange > 0 ? "+" : ""}{formatWeight(weightWeekChange)} / 7d
              </span>
            )}
          </Sub>
        </Card>
        <Card accent={weekSessions.length >= weekSessionTarget ? "rgba(200,255,0,0.3)" : undefined}>
          <Label accent={weekSessions.length >= weekSessionTarget ? ACCENT : "#facc15"}>Workouts This Week</Label>
          <BigValue accent={weekSessions.length >= weekSessionTarget ? ACCENT : "#facc15"}>
            {weekSessions.length}<span style={{ fontSize: 22, color: DIM }}>/{weekSessionTarget}</span>
          </BigValue>
          <Sub>{weekBurnedCals} kcal burned · target {weekCalTarget}</Sub>
        </Card>
        <Card>
          <Label>Last Workout</Label>
          <BigValue>
            {lastSession ? (
              <span style={{ fontSize: 22 }}>
                {new Date(lastSession.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            ) : "—"}
          </BigValue>
          <Sub>{lastSession?.location || "no sessions yet"}</Sub>
        </Card>
      </div>

      {/* ── Row 3: 7-day calorie trend ──────────────────────── */}
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 2,
        padding: "20px 24px",
        marginBottom: 24,
      }}>
        <Label>7-Day Calorie Intake</Label>
        <div style={{ height: 200, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekCalories}>
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(200,255,0,0.3)", borderRadius: 2 }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: ACCENT }}
                formatter={(v) => [`${v} kcal`, "Intake"]}
              />
              <Line type="monotone" dataKey="calories" stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
