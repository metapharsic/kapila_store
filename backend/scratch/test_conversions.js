const { getConversionMultiplier, convertQty } = require('../utils/units');

function testConversions() {
  console.log("Testing package size conversion logic...");
  
  // 1. Butter 500 Gm
  // pcs to kg -> should be 0.5
  const mult1 = getConversionMultiplier("pcs", "kg", "Butter 500 Gm");
  console.log("Butter 500 Gm (pcs -> kg):", mult1, "Expected: 0.5");
  
  // kg to pcs -> should be 2
  const mult2 = getConversionMultiplier("kg", "pcs", "Butter 500 Gm");
  console.log("Butter 500 Gm (kg -> pcs):", mult2, "Expected: 2");

  // 2. Milk 1 L
  // pcs to ml -> should be 1000
  const mult3 = getConversionMultiplier("pcs", "ml", "Milk 1 L");
  console.log("Milk 1 L (pcs -> ml):", mult3, "Expected: 1000");
  
  // ml to pcs -> should be 0.001
  const mult4 = getConversionMultiplier("ml", "pcs", "Milk 1 L");
  console.log("Milk 1 L (ml -> pcs):", mult4, "Expected: 0.001");
  
  // 3. Oil 500ml
  // pcs to l -> should be 0.5
  const mult5 = getConversionMultiplier("pcs", "l", "Oil 500ml");
  console.log("Oil 500ml (pcs -> l):", mult5, "Expected: 0.5");
  
  // l to pcs -> should be 2
  const mult6 = getConversionMultiplier("l", "pcs", "Oil 500ml");
  console.log("Oil 500ml (l -> pcs):", mult6, "Expected: 2");
}

testConversions();
