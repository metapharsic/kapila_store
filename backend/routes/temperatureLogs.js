const express = require("express");
const router = express.Router();
const temperatureController = require("../controllers/temperatureController");

router.get("/", temperatureController.list);
router.post("/", temperatureController.create);

module.exports = router;
