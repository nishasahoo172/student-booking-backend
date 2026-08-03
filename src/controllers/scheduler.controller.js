// import db from "../config/db.js";
// import { mysqlUtcToIso } from "../utils/datetime.js";
import db from "../config/db.js";
import { mysqlUtcToIso } from "../utils/datetime.js";
import { COURSE_RACKS } from "../config/racks.js";


function norm(v) {
  return String(v || "").trim();
}
export async function getBusy(req, res) {
  try {
    const vendor = norm(req.query.vendor);
    const course = norm(req.query.course);
    const rack = norm(req.query.rack);
    const start = norm(req.query.start);
    const end = norm(req.query.end);

    if (!vendor || !course || !start || !end) {
      return res.status(400).json({ message: "Missing vendor/course/start/end" });
    }

    const whereRack = rack ? "AND rack = ?" : "";
    const params = rack
      ? [vendor, course, rack, start, end]
      : [vendor, course, start, end];

    const [rows] = await db.execute(
      `
      SELECT id, userId, vendor, course, rack, startTime, endTime, status
      FROM bookings
      WHERE vendor = ?
        AND course = ?
        ${whereRack}
        AND status IN ('RESERVED','ACTIVE')
        AND NOT (endTime <= ? OR startTime >= ?)
      ORDER BY startTime ASC
      `,
      params
    );

    // const events = rows.map((r) => ({
    //   id: r.id,
    //   userId: r.userId,
    //   vendor: r.vendor,
    //   course: r.course,
    //   rack: r.rack,
    // start: r.startTime,
    // end: r.endTime,
    //   status: r.status,
    // }));

    // return res.json({ events });

    const events = rows.map((r) => ({
  id: r.id,
  userId: r.userId,
  vendor: r.vendor,
  course: r.course,
  rack: r.rack,
  // start: mysqlUtcToIso(r.startTime),
  // end: mysqlUtcToIso(r.endTime),
  start: r.startTime,
  end: r.endTime,
  status: r.status,
}));

const availableRacks =
  COURSE_RACKS[course] || ["1"];


  
return res.json({
  events,
  racks: availableRacks,
});


  } catch (err) {
    console.error("getBusy error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function checkCourseAccess(req, res) {
  return res.json({
    success: true,
  });
}