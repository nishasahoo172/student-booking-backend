// backend/src/app.js
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import schedulerRoutes from "./routes/scheduler.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import healthRoutes from "./routes/health.routes.js";
app.use("/api/scheduler", schedulerRoutes);

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/scheduler", schedulerRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/health", healthRoutes);

export default app;
