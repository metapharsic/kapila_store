const sharp = require("sharp");

async function checkPixels() {
  const imgPath = "C:/Users/Dell/.gemini/antigravity-ide/brain/648b105d-88b5-49ab-b3c7-c17ed87408b8/.user_uploaded/media_1788872980327.png";
  const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
  console.log("Info:", info);
  
  // Check top 20 rows of pixels
  for (let y = 0; y < 20; y++) {
    let row = [];
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      row.push(`(${r},${g},${b})`);
    }
    console.log(`Row ${y}:`, row.slice(0, 5).join(" "));
  }
}

checkPixels().catch(console.error);
