require('dotenv').config();
const localAI = require('./services/localAI');

async function testOcr() {
  console.log("Testing OCR...");
  // 1x1 pixel black JPEG
  const base64Image = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  
  try {
    const text = await localAI.ocrImage(base64Image, "image/jpeg");
    console.log("OCR Result:", text);
  } catch (err) {
    console.error("OCR Error:", err);
  }
}

testOcr();
