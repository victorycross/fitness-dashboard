// Unit-aware input components. Values always bubble up as metric strings (cm/kg).
import { kgToLbs, lbsToKg, cmToFtIn, ftInToCm, lbsHint, ftInHint } from "../utils/units.js";

const hintStyle = { fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 };

export function WeightInput({ valueKg, onChangeKg, units, style, placeholder, onKeyDown }) {
  if (units === "imperial") {
    const lbsDisplay = valueKg === "" || valueKg == null ? "" : kgToLbs(valueKg).toFixed(1);
    return (
      <>
        <input
          type="number"
          step="0.1"
          style={style}
          placeholder={placeholder ?? "e.g. 185"}
          value={lbsDisplay}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") { onChangeKg(""); return; }
            const kg = lbsToKg(raw);
            onChangeKg(kg == null ? "" : +kg.toFixed(2));
          }}
          onKeyDown={onKeyDown}
        />
        {valueKg !== "" && valueKg != null && (
          <div style={hintStyle}>≈ {Number(valueKg).toFixed(1)} kg</div>
        )}
      </>
    );
  }
  return (
    <>
      <input
        type="number"
        step="0.1"
        style={style}
        placeholder={placeholder ?? "e.g. 85.0"}
        value={valueKg ?? ""}
        onChange={(e) => onChangeKg(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {valueKg !== "" && valueKg != null && <div style={hintStyle}>{lbsHint(valueKg)}</div>}
    </>
  );
}

export function HeightInput({ valueCm, onChangeCm, units, style, placeholder }) {
  if (units === "imperial") {
    const ftIn = cmToFtIn(valueCm);
    const ft = ftIn?.ft ?? "";
    const inches = ftIn?.in ?? "";
    const handleChange = (newFt, newIn) => {
      if (newFt === "" && newIn === "") { onChangeCm(""); return; }
      const cm = ftInToCm(newFt || 0, newIn || 0);
      onChangeCm(String(Math.round(cm)));
    };
    return (
      <>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            style={{ ...style, flex: 1 }}
            placeholder="ft"
            value={ft}
            onChange={(e) => handleChange(e.target.value, inches)}
          />
          <input
            type="number"
            style={{ ...style, flex: 1 }}
            placeholder="in"
            value={inches}
            onChange={(e) => handleChange(ft, e.target.value)}
          />
        </div>
        {valueCm !== "" && valueCm != null && (
          <div style={hintStyle}>≈ {Math.round(Number(valueCm))} cm</div>
        )}
      </>
    );
  }
  return (
    <>
      <input
        type="number"
        style={style}
        placeholder={placeholder ?? "e.g. 170"}
        value={valueCm ?? ""}
        onChange={(e) => onChangeCm(e.target.value)}
      />
      {valueCm !== "" && valueCm != null && <div style={hintStyle}>{ftInHint(valueCm)}</div>}
    </>
  );
}
