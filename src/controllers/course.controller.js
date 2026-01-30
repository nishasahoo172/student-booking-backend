import db from "../config/db.js";

export async function listCourses(req, res) {
  try {
    const [rows] = await db.execute(
      "SELECT id, slug, name, vendor, ratePerHour, status FROM courses WHERE status='active' ORDER BY vendor, name"
    );
    return res.json(rows);
  } catch (e) {
    console.error("listCourses error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}
