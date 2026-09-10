const sharp = require("sharp");
const path = require("path");

const imgPath = "C:/Users/Dell/.gemini/antigravity-ide/brain/648b105d-88b5-49ab-b3c7-c17ed87408b8/.user_uploaded/media_1788872980327.png";

sharp(imgPath)
  .metadata()
  .then(meta => {
    console.log("Width:", meta.width, "Height:", meta.height, "Format:", meta.format);
  })
  .catch(err => console.error(err));
