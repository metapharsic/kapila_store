const fs = require("fs");
const rows = JSON.parse(fs.readFileSync("C:/Users/Dell/AppData/Local/Temp/claude/C--Users-Dell-Desktop-ERP-todo-final-todo-1952026/63d858ca-be8f-4207-9ee9-e71bc7eb645d/scratchpad/new_stock_parsed.json", "utf-8"));

async function run() {
  const loginRes = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@kapila.local", password: "ChangeMe123!" }),
  });
  const login = await loginRes.json();
  const token = login.data.accessToken;

  const today = new Date().toISOString().slice(0, 10);
  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const res = await fetch("http://localhost:3001/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: r.name, qty: r.qty > 0 ? r.qty : 0.01, unit: r.unit, date: today,
          price: r.price, category: r.category || null,
        }),
      });
      const json = await res.json();
      if (json.success) ok++; else { fail++; console.error("FAIL:", r.name, json.error); }
    } catch (e) {
      fail++; console.error("ERR:", r.name, e.message);
    }
  }
  console.log(`Done. ok=${ok} fail=${fail}`);
}
run();
