import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../theme.js";

export default function HistoryDropdown({ seasons, activeId, onSelect }) {
  const C = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = seasons.some((s) => s.id === activeId);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, []);

  const activeLabel = isActive ? seasons.find((s) => s.id === activeId)?.label : null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className="vgk-tab"
        style={{
          padding: "12px 20px", fontSize: 15, fontWeight: 500, letterSpacing: "1.5px",
          textTransform: "uppercase", fontFamily: "'Outfit', sans-serif",
          border: "none",
          borderBottom: isActive ? `2px solid ${C.gold}` : "2px solid transparent",
          background: isActive ? "rgba(201, 168, 76, 0.06)" : "transparent",
          color: isActive ? C.text : C.textDim,
          cursor: "pointer", transition: "all 0.25s ease",
          whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
        }}
      >
        {activeLabel ? `History · ${activeLabel}` : "History"}
        <svg width="10" height="6" viewBox="0 0 10 6" style={{
          transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)",
        }}>
          <path d="M1 1L5 5L9 1" stroke={isActive ? C.gold : C.textDim} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 6, overflow: "hidden", minWidth: 160, zIndex: 200,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          animation: "fadeIn 0.15s ease",
        }}>
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => { onSelect(s.id); setOpen(false); }}
              style={{
                display: "block", width: "100%", padding: "12px 18px", textAlign: "left",
                fontSize: 13, fontWeight: activeId === s.id ? 600 : 400,
                fontFamily: "'Outfit', sans-serif", letterSpacing: "1px",
                color: activeId === s.id ? C.gold : C.textMid,
                background: activeId === s.id ? "rgba(201,168,76,0.06)" : "transparent",
                border: "none", cursor: "pointer", transition: "all 0.15s",
                borderBottom: `1px solid ${C.border}`,
              }}
              onMouseEnter={(e) => { if (activeId !== s.id) e.target.style.background = "rgba(201,168,76,0.03)"; }}
              onMouseLeave={(e) => { if (activeId !== s.id) e.target.style.background = "transparent"; }}
            >
              {s.label} Season
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

