import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import schedulerRoutes from "./routes/scheduler.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import creditRoutes from "./routes/credit.routes.js";   // ADDED
import "./jobs/reminders.js";
import contactRoutes from "./routes/contact.routes.js";
import operationsRoutes from "./routes/operations.routes.js";
// import "./jobs/completeBookings.job.js";
import "./jobs/completeBookings.job.js";
const app = express();

app.use(cors());
app.use(express.json());
app.get("/api/health", (req, res) => res.json({ ok: true }));

//  API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/scheduler", schedulerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/credits", creditRoutes);   //  ADDED
app.use("/api/contact", contactRoutes);
app.use("/api/operations", operationsRoutes);
// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () =>
  console.log(` API running on http://localhost:${PORT}`)
);
