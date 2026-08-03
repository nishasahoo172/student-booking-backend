import express from "express";
// import db from "../db.js";
import db from "../config/db.js";
const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET ALL NOTICES (Admin)
|--------------------------------------------------------------------------
*/
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT *
      FROM system_operations
      ORDER BY createdAt DESC
    `);

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("GET /operations:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notices.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET ACTIVE NOTICES (Students)
|--------------------------------------------------------------------------
*/
router.get("/active", async (req, res) => {
  try {
    const { course = null, rack = null } = req.query;

    const [rows] = await db.execute(
      `
      SELECT *
      FROM system_operations
      WHERE enabled = 1
      AND (
        scope = 'ENTIRE_PORTAL'

        OR

        (scope = 'COURSE' AND course = ?)

        OR

        (
          scope = 'RACK'
          AND course = ?
          AND rack = ?
        )
      )
      ORDER BY priority DESC, createdAt DESC
      `,
      [
        course,
        course,
        rack,
      ]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("GET /operations/active:", err);

    res.status(500).json({
      success: false,
      message: "Failed to load active notices.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE NOTICE
|--------------------------------------------------------------------------
*/
router.post("/", async (req, res) => {
  try {
    const {
      scope,
      course,
      rack,
      severity,
      displayType,
      priority,
      dismissible,
      icon,
      title,
      message,
      enabled,
      startTime,
      endTime,
      createdBy,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and Message are required.",
      });
    }

    if (scope === "COURSE" && !course) {
      return res.status(400).json({
        success: false,
        message: "Course is required.",
      });
    }

    if (scope === "RACK") {
      if (!course || !rack) {
        return res.status(400).json({
          success: false,
          message: "Course and Rack are required.",
        });
      }
    }

    await db.execute(
      `
      INSERT INTO system_operations
      (
        scope,
        course,
        rack,
        severity,
        displayType,
        priority,
        dismissible,
        icon,
        title,
        message,
        enabled,
        startTime,
        endTime,
        createdBy
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        scope || "ENTIRE_PORTAL",
        course || null,
        rack || null,
        severity || "WARNING",
        displayType || "BANNER",
        priority || 1,
        dismissible ?? 1,
        icon || null,
        title,
        message,
        enabled ?? 1,
        startTime || null,
        endTime || null,
        createdBy || "Admin",
      ]
    );

    res.status(201).json({
      success: true,
      message: "Notice created successfully.",
    });
  } catch (err) {
    console.error("POST /operations:", err);

    res.status(500).json({
      success: false,
      message: "Failed to create notice.",
    });
  }
});


router.put("/:id", async (req, res) => {
  try {
    const {
      scope,
      course,
      rack,
      severity,
      displayType,
      priority,
      dismissible,
      icon,
      title,
      message,
      enabled,
      startTime,
      endTime,
    } = req.body;

    await db.execute(
      `UPDATE system_operations
       SET
         scope=?,
         course=?,
         rack=?,
         severity=?,
         displayType=?,
         priority=?,
         dismissible=?,
         icon=?,
         title=?,
         message=?,
         enabled=?,
         startTime=?,
         endTime=?
       WHERE id=?`,
      [
        scope,
        course,
        rack,
        severity,
        displayType,
        priority,
        dismissible,
        icon,
        title,
        message,
        enabled,
        startTime,
        endTime,
        req.params.id,
      ]
    );

    res.json({
      success: true,
      message: "Notice updated successfully.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to update notice.",
    });
  }
});


router.patch("/:id/toggle", async (req, res) => {
  try {
    await db.execute(
      `
      UPDATE system_operations
      SET enabled = NOT enabled
      WHERE id=?
      `,
      [req.params.id]
    );

    res.json({
      success: true,
      message: "Notice status updated successfully.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to update status.",
    });
  }
});


router.get("/active", async (req, res) => {
  try {
    const { course, rack } = req.query;

    const [rows] = await db.execute(
      `
      SELECT *
      FROM system_operations
      WHERE enabled = 1
      AND (
        startTime IS NULL
        OR startTime <= NOW()
      )
      AND (
        endTime IS NULL
        OR endTime >= NOW()
      )
      ORDER BY createdAt DESC
      `
    );

    const notices = rows.filter((notice) => {
      if (notice.scope === "ENTIRE_PORTAL") {
        return true;
      }

      if (
        notice.scope === "COURSE" &&
        notice.course === course
      ) {
        return true;
      }

      if (
        notice.scope === "RACK" &&
        notice.course === course &&
        notice.rack === rack
      ) {
        return true;
      }

      return false;
    });

    res.json({
      success: true,
      data: notices,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to load notices.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.execute(
      `
      DELETE FROM system_operations
      WHERE id=?
      `,
      [req.params.id]
    );

    res.json({
      success: true,
      message: "Notice deleted successfully.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to delete notice.",
    });
  }
});

export default router;