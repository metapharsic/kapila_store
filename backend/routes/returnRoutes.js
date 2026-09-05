const express = require("express");
const router = express.Router();
const returnController = require("../controllers/returnController");

router.get("/", returnController.list);
router.get("/:id", returnController.getOne);
router.post("/", returnController.create);
router.post("/:id/approve", returnController.approve);

module.exports = router;
