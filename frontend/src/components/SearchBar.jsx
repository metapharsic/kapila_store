import { useState } from "react";
import { COLORS } from "../styles/colors";
import Btn from "./Btn";

export default function SearchBar({ onSearch, placeholder = "Search…" }) {
  const [q, setQ] = useState("");

  const submit = (e) => {
    e.preventDefault();
    onSearch(q.trim());
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, width: "100%", minWidth: 0 }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); if (!e.target.value) onSearch(""); }}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: "7px 16px", fontSize: 13, color: COLORS.text }}
      />
      <Btn type="submit" variant="primary" small style={{ borderRadius: 20, padding: "7px 16px" }}>Search</Btn>
    </form>
  );
}
