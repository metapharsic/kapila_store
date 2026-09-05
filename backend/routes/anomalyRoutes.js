const express = require("express");
const router = express.Router();
const { list, update } = require("../controllers/anomalyController");

router.get("/", list);
router.patch("/:id", update);

module.exports = router;
