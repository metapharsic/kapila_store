const router = require("express").Router();
const ctrl = require("../controllers/staffHrmsController");
const paginate = require("../middleware/paginate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

// Export Excel
router.get("/export-excel", requireAnyPermission(["staff.view", "night_audit.export"]), ctrl.exportExcel);

// Employees Directory
router.get("/employees", requirePermission("staff.view"), paginate(["id", "emp_code", "created_at"]), ctrl.listEmployees);
router.post("/employees", requirePermission("staff.create"), ctrl.createEmployee);
router.patch("/employees/:id", requirePermission("staff.manage"), ctrl.updateEmployee);

// Shift Attendance
router.get("/attendance", requirePermission("attendance.view"), paginate(["attendance_date", "created_at"]), ctrl.listAttendance);
router.post("/attendance", requirePermission("attendance.record"), ctrl.recordAttendance);

// Leaves
router.get("/leaves", requirePermission("staff.view"), paginate(["start_date", "created_at"]), ctrl.listLeaves);
router.post("/leaves", requirePermission("staff.view"), ctrl.applyLeave);
router.patch("/leaves/:id/review", requirePermission("staff.manage"), ctrl.reviewLeave);

module.exports = router;
