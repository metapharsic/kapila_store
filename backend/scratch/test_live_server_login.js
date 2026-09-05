async function testLiveLogin() {
  const ports = [3001, 3000, 5000, 8008];
  for (const port of ports) {
    try {
      console.log(`Testing http://localhost:${port}/api/auth/login with PIN...`);
      const res = await fetch(`http://localhost:${port}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_code: "KPL-STORE",
          pin: "1234",
          shift_type: "Morning",
          terminal_code: "STORE-MAIN-TAB-01"
        })
      });
      const data = await res.json();
      console.log(`Port ${port} response status: ${res.status}`, data);
    } catch (e) {
      console.log(`Port ${port} failed: ${e.message}`);
    }
  }
}

testLiveLogin();
