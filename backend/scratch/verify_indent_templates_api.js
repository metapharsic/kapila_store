async function testTemplates() {
  console.log("=== VERIFYING INDENT TEMPLATES API ===");

  // 1. Log in to get accessToken
  const loginRes = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "store@kapila.com", password: "ChangeMe123!" }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  if (!token) {
    console.error("❌ Failed to log in:", loginData);
    process.exit(1);
  }
  console.log("✅ Authenticated as Store Keeper");

  // 2. Fetch all templates
  const tmplRes = await fetch("http://localhost:3001/api/indents/templates", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tmplData = await tmplRes.json();
  console.log(`✅ Fetched templates list: HTTP ${tmplRes.status}`);
  console.log(`   Found ${tmplData.data?.length} department templates:`);
  for (const t of tmplData.data) {
    console.log(`   - ${t.icon} ${t.dept} (${t.displayName}): ${t.item_count} items`);
  }

  // 3. Fetch TIFFINS template details
  const tiffinsRes = await fetch("http://localhost:3001/api/indents/templates/TIFFINS", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tiffinsData = await tiffinsRes.json();
  console.log(`✅ Fetched TIFFINS details: HTTP ${tiffinsRes.status}, items: ${tiffinsData.data?.items?.length}`);
  const sample = tiffinsData.data?.items?.slice(0, 3);
  console.log("   Sample items with stock awareness:", JSON.stringify(sample, null, 2));

  // 4. Fetch NORTH INDIAN template details
  const niRes = await fetch("http://localhost:3001/api/indents/templates/NORTH%20INDIAN", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const niData = await niRes.json();
  console.log(`✅ Fetched NORTH INDIAN details: HTTP ${niRes.status}, items: ${niData.data?.items?.length}`);

  if (tmplData.data?.length === 9 && tiffinsData.data?.items?.length > 0) {
    console.log("\n🎉 ALL BACKEND TEMPLATE TESTS PASSED!");
    process.exit(0);
  } else {
    console.error("\n❌ Some tests did not meet expected counts.");
    process.exit(1);
  }
}

testTemplates().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
