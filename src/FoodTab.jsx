/**
 * FoodTab — Food Tracker tab with 7-day strip and drag-to-move entries.
 *
 * Props: supabase, user, toast(msg)
 *
 * Storage: food_log, food_day_status
 * AI parse: parse-food edge function
 */
import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
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

function addDays(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return localDateStr(d);
}

function weekDaysAround(dateStr) {
  // Returns 7 date strings centred on dateStr (3 before, target, 3 after).
  return [-3, -2, -1, 0, 1, 2, 3].map((d) => addDays(dateStr, d));
}

const MEAL_COLS = ["breakfast", "lunch", "dinner"];
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

function mealEmoji(m) {
  return { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" }[m] || "🍽️";
}

function sumRows(rows) {
  return rows.reduce(
    (a, r) => ({
      calories: a.calories + Number(r.calories || 0),
      protein_g: a.protein_g + Number(r.protein_g || 0),
      carbs_g: a.carbs_g + Number(r.carbs_g || 0),
      fat_g: a.fat_g + Number(r.fat_g || 0),
      fibre_g: a.fibre_g + Number(r.fibre_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 },
  );
}

function fmtTotals(t) {
  const parts = [
    `${Math.round(t.calories)} kcal`,
    `P ${Math.round(t.protein_g)}g`,
    `C ${Math.round(t.carbs_g)}g`,
    `F ${Math.round(t.fat_g)}g`,
  ];
  if (t.fibre_g > 0) parts.push(`Fibre ${Math.round(t.fibre_g)}g`);
  return parts.join(" · ");
}

function buildFoodText(rows, start, end, days) {
  const byDate = {};
  for (const r of rows) (byDate[r.date] ??= []).push(r);

  const headerRange =
    days === 1
      ? new Date(start + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : `${start} to ${end} (${days} days)`;

  const grand = sumRows(rows);
  const summary =
    days === 1
      ? `Totals: ${fmtTotals(grand)}`
      : `Grand total: ${fmtTotals(grand)}\nDaily avg:   ${Math.round(grand.calories / days)} kcal · P ${Math.round(grand.protein_g / days)}g · C ${Math.round(grand.carbs_g / days)}g · F ${Math.round(grand.fat_g / days)}g`;

  const dateSections = Object.keys(byDate)
    .sort()
    .map((date) => {
      const dayRows = byDate[date];
      const dayTotals = sumRows(dayRows);
      const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      const mealSections = MEAL_ORDER.filter((m) => dayRows.some((r) => (r.meal || "snack") === m))
        .map((m) => {
          const mealRows = dayRows.filter((r) => (r.meal || "snack") === m);
          const lines = mealRows
            .map((e) => {
              const head = `  • ${e.name} — ${e.quantity} ${e.unit}`;
              const macros = `    ${e.calories} kcal · P ${Math.round(Number(e.protein_g))}g · C ${Math.round(Number(e.carbs_g))}g · F ${Math.round(Number(e.fat_g))}g${e.fibre_g > 0 ? ` · Fi ${Math.round(Number(e.fibre_g))}g` : ""}`;
              const note = e.notes ? `\n    (${e.notes})` : "";
              return `${head}\n${macros}${note}`;
            })
            .join("\n");
          return `${mealEmoji(m)} ${m.toUpperCase()}\n${lines}`;
        })
        .join("\n\n");

      const header = `─────────────────────────────────────────\n${dateLabel}\n${fmtTotals(dayTotals)}\n─────────────────────────────────────────`;
      return `${header}\n\n${mealSections || "  (no entries)"}`;
    })
    .join("\n\n\n");

  return `Food Log — ${headerRange}
${summary}


${dateSections}
`;
}

/* ── MealColumn — header + entries for a single meal ─────────────── */
function MealColumn({ meal, entries, onDelete }) {
  return (
    <div>
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
      {entries.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.25)",
            fontStyle: "italic",
            padding: "10px 0",
            borderTop: `1px dashed ${BORDER}`,
            marginBottom: 8,
          }}
        >
          Nothing logged.
        </div>
      ) : (
        entries.map((entry) => <DraggableEntry key={entry.id} entry={entry} onDelete={onDelete} />)
      )}
    </div>
  );
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

/* ── DayCell — droppable day in the 7-day strip ──────────────────── */
function DayCell({ date, selected, isToday, count, onClick }) {
  const { isOver, setNodeRef } = useDroppable({ id: `day-${date}`, data: { date } });
  const dow = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3).toUpperCase();
  const dayNum = new Date(date + "T00:00:00").getDate();
  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      style={{
        flex: "1 0 auto",
        minWidth: 48,
        minHeight: 72,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: "10px 4px",
        background: selected
          ? ACCENT
          : isOver
          ? "rgba(200,255,0,0.18)"
          : "rgba(255,255,255,0.03)",
        color: selected ? BG : isToday ? ACCENT : "#fff",
        border: `1px solid ${isOver ? ACCENT : selected ? ACCENT : BORDER}`,
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "'Barlow Condensed', sans-serif",
        transition: "background 0.1s, border-color 0.1s",
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: 1, opacity: selected ? 0.7 : 0.5 }}>{dow}</span>
      <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{dayNum}</span>
      <span
        style={{
          fontSize: 9,
          height: 10,
          color: selected ? BG : count > 0 ? ACCENT : "transparent",
          opacity: selected ? 0.8 : 1,
        }}
      >
        {count > 0 ? `${count} ${count === 1 ? "item" : "items"}` : "·"}
      </span>
    </button>
  );
}

/* ── DraggableEntry — food row with drag handle ──────────────────── */
function DraggableEntry({ entry, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry-${entry.id}`,
    data: { entry },
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        ...card,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: 14,
        marginBottom: 8,
        opacity: isDragging ? 0.3 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          <span style={{ color: DIM, marginRight: 6, fontSize: 13 }} aria-hidden>⋮⋮</span>
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
      <button
        style={btnDanger}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
        title="Delete entry"
      >
        ✕
      </button>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export default function FoodTab({ supabase, user, toast }) {
  const [weekEntries, setWeekEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [nlInput, setNlInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDays, setHistoryDays] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);

  const weekDates = weekDaysAround(selectedDate);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];

  // Sensors: mouse + touch. Touch uses a short delay so list scrolling still works.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );

  /* ── Load 7-day window + finalized status for selected date ──── */
  const loadWeek = useCallback(async () => {
    setLoading(true);
    const [entriesRes, statusRes] = await Promise.all([
      supabase.from("food_log").select("*").gte("date", weekStart).lte("date", weekEnd).order("created_at", { ascending: true }),
      supabase.from("food_day_status").select("date").eq("date", selectedDate).maybeSingle(),
    ]);

    if (entriesRes.error) {
      console.error("food_log load error:", entriesRes.error);
      toast?.("Failed to load food log.");
    }
    setWeekEntries(entriesRes.data || []);
    setFinalized(!!statusRes.data);
    setLoading(false);
  }, [supabase, weekStart, weekEnd, selectedDate, toast]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  const entries = weekEntries.filter((e) => e.date === selectedDate);

  // Counts per day for the strip badges.
  const countByDate = weekEntries.reduce((m, e) => {
    m[e.date] = (m[e.date] || 0) + 1;
    return m;
  }, {});

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
      if (date === selectedDate) loadWeek();
      else setSelectedDate(date);
    } catch (err) {
      console.error("parse-food error:", err);
      toast?.("AI parse failed — " + (err.message || "try again."));
    }
    setParsing(false);
  }

  /* ── Export text for a day / week / month ending on selectedDate ─ */
  async function exportText(days) {
    const end = selectedDate;
    const start = addDays(end, -(days - 1));

    const { data, error } = await supabase
      .from("food_log")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast?.("Export failed — " + error.message);
      return;
    }
    const rows = data || [];
    if (rows.length === 0) {
      toast?.(`No entries to export for the last ${days} day${days === 1 ? "" : "s"}.`);
      return;
    }

    const text = buildFoodText(rows, start, end, days);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = days === 1 ? `food_log_${end}.txt` : `food_log_${start}_to_${end}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast?.(`Exported ${rows.length} entries.`);
  }

  /* ── Delete entry ─────────────────────────────────────────────── */
  async function handleDelete(id) {
    const { error } = await supabase.from("food_log").delete().eq("id", id);
    if (error) {
      toast?.("Failed to delete entry.");
      return;
    }
    setWeekEntries((prev) => prev.filter((e) => e.id !== id));
    toast?.("Entry removed.");
  }

  /* ── Drag-to-move ─────────────────────────────────────────────── */
  function handleDragStart(event) {
    const entry = event.active?.data?.current?.entry;
    if (entry) setActiveDrag(entry);
  }

  async function handleDragEnd(event) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const entry = active.data.current?.entry;
    const newDate = over.data.current?.date;
    if (!entry || !newDate || entry.date === newDate) return;

    // Optimistic update
    setWeekEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, date: newDate } : e)));

    const { error } = await supabase
      .from("food_log")
      .update({ date: newDate })
      .eq("id", entry.id);

    if (error) {
      toast?.("Move failed — reverting.");
      loadWeek();
      return;
    }
    toast?.(`Moved to ${shortDate(newDate)}.`);
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

  const today = todayStr();

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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

        {/* ── 7-day strip (drop targets) ──────────────────────────── */}
        <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ ...label, marginBottom: 0 }}>
            Week of {shortDate(weekStart)}
          </span>
          <span style={{ fontSize: 11, color: DIM, fontStyle: "italic" }}>
            Drag an entry to a day to move it
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 16,
            overflowX: "auto",
            paddingBottom: 4,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {weekDates.map((date) => (
            <DayCell
              key={date}
              date={date}
              selected={date === selectedDate}
              isToday={date === today}
              count={countByDate[date] || 0}
              onClick={() => setSelectedDate(date)}
            />
          ))}
        </div>

        {/* ── Daily totals ────────────────────────────────────────── */}
        {entries.length > 0 && (
          <div style={{ ...card, borderLeft: `3px solid ${ACCENT}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
              <div style={label}>
                Daily Totals — {shortDate(selectedDate)}
                {finalized && <span style={{ color: ACCENT, marginLeft: 8 }}>· Finished ✓</span>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: DIM, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Export:</span>
                {[
                  ["Day", 1],
                  ["Week", 7],
                  ["Month", 30],
                ].map(([lbl, n]) => (
                  <button
                    key={lbl}
                    onClick={() => exportText(n)}
                    style={{
                      ...btn,
                      background: "transparent",
                      color: ACCENT,
                      border: `1px solid ${ACCENT}`,
                      padding: "6px 12px",
                      fontSize: 12,
                    }}
                    title={`Download last ${n} day${n === 1 ? "" : "s"} as text`}
                  >
                    {lbl}
                  </button>
                ))}
                <button
                  onClick={toggleFinalized}
                  style={{
                    ...btn,
                    background: finalized ? "transparent" : ACCENT,
                    color: finalized ? ACCENT : BG,
                    border: `1px solid ${ACCENT}`,
                    padding: "8px 14px",
                    fontSize: 12,
                    marginLeft: 8,
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
            No food logged for {selectedDate === today ? "today" : shortDate(selectedDate)}.
            <br />
            <span style={{ fontSize: 13 }}>Type what you ate above and hit Log Food.</span>
          </div>
        ) : (
          <>
            {/* Breakfast · Lunch · Dinner — 3 columns on ≥640px, stacks below */}
            <div className="meal-grid">
              {MEAL_COLS.map((meal) => (
                <MealColumn
                  key={meal}
                  meal={meal}
                  entries={entries.filter((e) => e.meal === meal)}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* Snacks — full-width row below */}
            {entries.some((e) => e.meal === "snack") && (
              <div style={{ marginBottom: 20 }}>
                <MealColumn
                  meal="snack"
                  entries={entries.filter((e) => e.meal === "snack")}
                  onDelete={handleDelete}
                />
              </div>
            )}
          </>
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

      {/* Floating drag preview — compact pill so it doesn't cover multiple day cells */}
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div
            style={{
              background: ACCENT,
              color: BG,
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
              boxShadow: "0 6px 16px rgba(0,0,0,0.5)",
              pointerEvents: "none",
              maxWidth: 180,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {activeDrag.name} · {activeDrag.calories} kcal
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
