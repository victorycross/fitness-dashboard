/**
 * FoodTab — React component for the Food Tracker tab.
 *
 * Drop this into the fitness dashboard's App.jsx as a sibling to the
 * existing tab components (GoalsTab, ProfileTab, etc.).
 *
 * Required props:
 *   supabase  — Supabase client instance
 *   user      — current auth user object
 *   toast     — function(message) to show a toast notification
 *
 * Database: reads/writes the `food_log` table (see migration).
 * AI parse: calls the `parse-food` Supabase Edge Function.
 */
import { useState, useEffect, useCallback } from "react";
import { localDateStr } from "./utils/date.js";

/* ── Style constants (matching fitness dashboard) ───────────────── */
const ACCENT = "#C8FF00";
const BG = "#0e0e0e";
const CARD_BG = "#181818";
const BORDER = "#222";
const DIM = "rgba(255,255,255,0.5)";

const card = {
  background: CARD_BG,
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
  border: `1px solid ${BORDER}`,
};

const btn = {
  background: ACCENT,
  color: BG,
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: 1,
  textTransform: "uppercase",
  cursor: "pointer",
};

const btnDanger = {
  ...btn,
  background: "transparent",
  color: "#ff4444",
  border: "1px solid #ff4444",
  padding: "6px 12px",
  fontSize: 12,
};

const input = {
  background: "#111",
  color: "#fff",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "10px 14px",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  width: "100%",
};

const label = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 600,
  fontSize: 12,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: DIM,
  marginBottom: 6,
  display: "block",
};

/* ── Helpers ─────────────────────────────────────────────────────── */
function todayStr() {
  return localDateStr();
}

function shortDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const MEALS = ["breakfast", "lunch", "dinner", "snack"];

function mealEmoji(m) {
  return { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" }[m] || "🍽️";
}

/* ── NutritionBar — compact macro bar ────────────────────────────── */
function NutritionBar({ calories, protein_g, carbs_g, fat_g }) {
  const total = protein_g + carbs_g + fat_g || 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, color: ACCENT }}>
        {Math.round(calories)} kcal
      </span>
      <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 120, height: 6, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${(protein_g / total) * 100}%`, background: "#4dabf7", borderRadius: 3 }} />
        <div style={{ width: `${(carbs_g / total) * 100}%`, background: "#ffd43b", borderRadius: 3 }} />
        <div style={{ width: `${(fat_g / total) * 100}%`, background: "#ff6b6b", borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 13, color: DIM, fontFamily: "'Barlow Condensed', sans-serif" }}>
        <span><span style={{ color: "#4dabf7" }}>●</span> P {Math.round(protein_g)}g</span>
        <span><span style={{ color: "#ffd43b" }}>●</span> C {Math.round(carbs_g)}g</span>
        <span><span style={{ color: "#ff6b6b" }}>●</span> F {Math.round(fat_g)}g</span>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export default function FoodTab({ supabase, user, toast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [nlInput, setNlInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDays, setHistoryDays] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [finalized, setFinalized] = useState(false);

  /* ── Load entries + finalized status for selected date ────────── */
  const loadEntries = useCallback(async () => {
    setLoading(true);
    const [entriesRes, statusRes] = await Promise.all([
      supabase.from("food_log").select("*").eq("date", selectedDate).order("created_at", { ascending: true }),
      supabase.from("food_day_status").select("date").eq("date", selectedDate).maybeSingle(),
    ]);

    if (entriesRes.error) {
      console.error("food_log load error:", entriesRes.error);
      toast?.("Failed to load food log.");
    }
    setEntries(entriesRes.data || []);
    setFinalized(!!statusRes.data);
    setLoading(false);
  }, [supabase, selectedDate, toast]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  /* ── Toggle finalized for selected date ──────────────────────── */
  async function toggleFinalized() {
    if (finalized) {
      const { error } = await supabase.from("food_day_status").delete().eq("date", selectedDate);
      if (error) { toast?.("Failed to reopen day."); return; }
      setFinalized(false);
      toast?.("Day reopened.");
    } else {
      const { error } = await supabase.from("food_day_status").insert({ user_id: user.id, date: selectedDate });
      if (error) { toast?.("Failed to finalize day."); return; }
      setFinalized(true);
      toast?.("Day marked as finished ✓");
    }
  }

  /* ── Daily totals ─────────────────────────────────────────────── */
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + Number(e.calories),
      protein_g: acc.protein_g + Number(e.protein_g),
      carbs_g: acc.carbs_g + Number(e.carbs_g),
      fat_g: acc.fat_g + Number(e.fat_g),
      fibre_g: acc.fibre_g + Number(e.fibre_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 },
  );

  /* ── NL parse via Edge Function ───────────────────────────────── */
  async function handleParse() {
    if (!nlInput.trim()) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-food", {
        body: { description: nlInput.trim(), today: todayStr() },
      });
      if (error) throw error;

      const foods = data.foods || [];
      if (foods.length === 0) {
        toast?.("Couldn't identify any foods. Try being more specific.");
        setParsing(false);
        return;
      }

      const meal = data.meal || "snack";
      const date = data.date || selectedDate;

      const rows = foods.map((f) => ({
        user_id: user.id,
        date,
        meal,
        name: f.name,
        quantity: parseFloat(f.quantity) || 1,
        unit: f.unit || "serving",
        calories: f.calories || 0,
        protein_g: f.protein_g || 0,
        carbs_g: f.carbs_g || 0,
        fat_g: f.fat_g || 0,
        fibre_g: f.fibre_g || 0,
        notes: data.notes || null,
      }));

      const { error: insertErr } = await supabase.from("food_log").insert(rows);
      if (insertErr) throw insertErr;

      toast?.(`Logged ${foods.length} food(s) for ${meal}.`);
      setNlInput("");
      if (date === selectedDate) loadEntries();
      else setSelectedDate(date);
    } catch (err) {
      console.error("parse-food error:", err);
      toast?.("AI parse failed — " + (err.message || "try again."));
    }
    setParsing(false);
  }

  /* ── Export selected day as HealthKit sample JSON ─────────────── */
  function exportHealthKit() {
    if (entries.length === 0) {
      toast?.("Nothing to export for this day.");
      return;
    }
    const samples = [];
    for (const e of entries) {
      const ts = e.created_at || `${e.date}T12:00:00`;
      const note = e.name;
      const pairs = [
        ["dietaryEnergyConsumed", Number(e.calories), "kcal"],
        ["dietaryProtein", Number(e.protein_g), "g"],
        ["dietaryCarbohydrates", Number(e.carbs_g), "g"],
        ["dietaryFatTotal", Number(e.fat_g), "g"],
        ["dietaryFiber", Number(e.fibre_g || 0), "g"],
      ];
      for (const [type, value, unit] of pairs) {
        if (value > 0) samples.push({ type, value: +value.toFixed(2), unit, date: ts, note });
      }
    }
    const payload = {
      date: selectedDate,
      generated: new Date().toISOString(),
      sample_count: samples.length,
      samples,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthkit_samples_${selectedDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast?.(`Exported ${samples.length} HealthKit samples.`);
  }

  /* ── Delete entry ─────────────────────────────────────────────── */
  async function handleDelete(id) {
    const { error } = await supabase.from("food_log").delete().eq("id", id);
    if (error) {
      toast?.("Failed to delete entry.");
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast?.("Entry removed.");
  }

  /* ── Load history (last 14 days) ──────────────────────────────── */
  async function loadHistory() {
    setHistoryLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 13);
    const sinceStr = localDateStr(since);

    const { data, error } = await supabase
      .from("food_log")
      .select("date, calories, protein_g, carbs_g, fat_g")
      .gte("date", sinceStr)
      .order("date", { ascending: true });

    if (error) {
      toast?.("Failed to load history.");
      setHistoryLoading(false);
      return;
    }

    // Group by date
    const byDate = {};
    (data || []).forEach((r) => {
      if (!byDate[r.date]) byDate[r.date] = { date: r.date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, count: 0 };
      byDate[r.date].calories += Number(r.calories);
      byDate[r.date].protein_g += Number(r.protein_g);
      byDate[r.date].carbs_g += Number(r.carbs_g);
      byDate[r.date].fat_g += Number(r.fat_g);
      byDate[r.date].count += 1;
    });

    setHistoryDays(Object.values(byDate));
    setHistoryLoading(false);
    setShowHistory(true);
  }

  /* ── Date navigation ──────────────────────────────────────────── */
  function shiftDate(delta) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(localDateStr(d));
  }

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* ── Natural language input ──────────────────────────────── */}
      <div style={card}>
        <div style={label}>Log food with AI</div>
        <textarea
          style={{ ...input, minHeight: 60, resize: "vertical", marginBottom: 10 }}
          placeholder='e.g. "2 eggs and toast with peanut butter for breakfast" or "chicken stir fry with rice for dinner"'
          value={nlInput}
          onChange={(e) => setNlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleParse();
            }
          }}
        />
        <button style={{ ...btn, opacity: parsing ? 0.6 : 1 }} onClick={handleParse} disabled={parsing}>
          {parsing ? "Parsing…" : "Log Food"}
        </button>
      </div>

      {/* ── Date selector ───────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          marginBottom: 16,
          fontFamily: "'Barlow Condensed', sans-serif",
        }}
      >
        <button onClick={() => shiftDate(-1)} style={{ ...btn, padding: "6px 14px" }}>
          ◀
        </button>
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>
          {selectedDate === todayStr() ? "Today" : shortDate(selectedDate)}
        </span>
        <button
          onClick={() => shiftDate(1)}
          style={{ ...btn, padding: "6px 14px", opacity: selectedDate >= todayStr() ? 0.3 : 1 }}
          disabled={selectedDate >= todayStr()}
        >
          ▶
        </button>
      </div>

      {/* ── Daily totals ────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div style={{ ...card, borderLeft: `3px solid ${ACCENT}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
            <div style={label}>Daily Totals {finalized && <span style={{ color: ACCENT, marginLeft: 8 }}>· Finished ✓</span>}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={exportHealthKit}
                style={{
                  ...btn,
                  background: "transparent",
                  color: ACCENT,
                  border: `1px solid ${ACCENT}`,
                  padding: "8px 14px",
                  fontSize: 12,
                }}
                title="Download HealthKit samples JSON for this day"
              >
                ↓ Apple Health JSON
              </button>
              <button
                onClick={toggleFinalized}
                style={{
                  ...btn,
                  background: finalized ? "transparent" : ACCENT,
                  color: finalized ? ACCENT : BG,
                  border: `1px solid ${ACCENT}`,
                  padding: "8px 14px",
                  fontSize: 12,
                }}
              >
                {finalized ? "Reopen Day" : "Finished for the day"}
              </button>
            </div>
          </div>
          <NutritionBar {...totals} />
          {totals.fibre_g > 0 && (
            <div style={{ fontSize: 13, color: DIM, marginTop: 6, fontFamily: "'Barlow Condensed', sans-serif" }}>
              Fibre: {Math.round(totals.fibre_g)}g
            </div>
          )}
        </div>
      )}

      {/* ── Entries by meal ─────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: "center", color: DIM, padding: 40 }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: "center", color: DIM, padding: 40 }}>
          No food logged for {selectedDate === todayStr() ? "today" : shortDate(selectedDate)}.
          <br />
          <span style={{ fontSize: 13 }}>Type what you ate above and hit Log Food.</span>
        </div>
      ) : (
        MEALS.map((meal) => {
          const mealEntries = entries.filter((e) => e.meal === meal);
          if (mealEntries.length === 0) return null;
          return (
            <div key={meal} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: DIM,
                  marginBottom: 8,
                }}
              >
                {mealEmoji(meal)} {meal}
              </div>
              {mealEntries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    ...card,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: 14,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {entry.name}
                      <span style={{ color: DIM, fontWeight: 400, fontSize: 14, marginLeft: 8 }}>
                        {entry.quantity} {entry.unit}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        fontSize: 13,
                        color: DIM,
                        fontFamily: "'Barlow Condensed', sans-serif",
                      }}
                    >
                      <span style={{ color: ACCENT }}>{entry.calories} kcal</span>
                      <span>P:{Math.round(Number(entry.protein_g))}g</span>
                      <span>C:{Math.round(Number(entry.carbs_g))}g</span>
                      <span>F:{Math.round(Number(entry.fat_g))}g</span>
                    </div>
                    {entry.notes && (
                      <div style={{ fontSize: 12, color: DIM, marginTop: 4, fontStyle: "italic" }}>
                        {entry.notes}
                      </div>
                    )}
                  </div>
                  <button style={btnDanger} onClick={() => handleDelete(entry.id)} title="Delete entry">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          );
        })
      )}

      {/* ── History toggle ──────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginTop: 8, marginBottom: 24 }}>
        <button
          style={{ ...btn, background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}` }}
          onClick={() => (showHistory ? setShowHistory(false) : loadHistory())}
        >
          {showHistory ? "Hide History" : historyLoading ? "Loading…" : "Show 14-Day History"}
        </button>
      </div>

      {/* ── History view ────────────────────────────────────────── */}
      {showHistory && historyDays.length > 0 && (
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>14-Day Overview</div>
          {historyDays.map((day) => (
            <div
              key={day.date}
              onClick={() => {
                setSelectedDate(day.date);
                setShowHistory(false);
              }}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: `1px solid ${BORDER}`,
                cursor: "pointer",
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{shortDate(day.date)}</span>
                <span style={{ color: DIM, fontSize: 13, marginLeft: 8 }}>{day.count} items</span>
              </div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: ACCENT }}>
                {Math.round(day.calories)} kcal
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
