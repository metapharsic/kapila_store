async function testLogin() {
  const tests = [
    {
      name: "Store Keeper by Email (store@kapila.com)",
      payload: { email: "store@kapila.com", password: "ChangeMe123!" },
      expectStatus: 200,
    },
    {
      name: "Store Keeper by Employee Code (KPL-STORE)",
      payload: { employee_code: "KPL-STORE", password: "ChangeMe123!" },
      expectStatus: 200,
    },
    {
      name: "Admin by Code (KPL-ADMIN)",
      payload: { employee_code: "KPL-ADMIN", password: "ChangeMe123!" },
      expectStatus: 200,
    },
    {
      name: "Chef by Email (Chef@kapila.com)",
      payload: { email: "Chef@kapila.com", password: "ChangeMe123!" },
      expectStatus: 200,
    },
    {
      name: "Incorrect Password Rejection",
      payload: { email: "store@kapila.com", password: "WrongPassword999!" },
      expectStatus: 401,
    },
    {
      name: "Non-existent User Rejection",
      payload: { email: "ghost@kapila.com", password: "ChangeMe123!" },
      expectStatus: 401,
    },
  ];

  console.log("==================================================");
  console.log("  MULTI-AGENT DB-DRIVEN AUTH VERIFICATION SUITE   ");
  console.log("==================================================");

  let passed = 0;
  for (const t of tests) {
    try {
      const res = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t.payload),
      });

      const data = await res.json();
      const statusMatches = res.status === t.expectStatus;

      if (statusMatches) {
        console.log(`✅ [PASS] ${t.name} -> HTTP ${res.status}`);
        if (res.status === 200) {
          console.log(`      User: ${data.data?.user?.name} (${data.data?.user?.employee_code})`);
          console.log(`      Roles: ${data.data?.user?.roles?.map(r => r.name || r.key).join(", ")}`);
          console.log(`      Token Issued: ${data.data?.accessToken ? "YES (JWT Verified)" : "NO"}`);
        } else {
          console.log(`      Rejection Error: "${data.error}"`);
        }
        passed++;
      } else {
        console.error(`❌ [FAIL] ${t.name} -> Expected HTTP ${t.expectStatus}, got ${res.status}`);
        console.error("      Response:", data);
      }
    } catch (err) {
      console.error(`❌ [ERROR] ${t.name} -> ${err.message}`);
    }
    console.log("--------------------------------------------------");
  }

  console.log(`Results: ${passed}/${tests.length} tests passed.`);
  process.exit(passed === tests.length ? 0 : 1);
}

testLogin();
