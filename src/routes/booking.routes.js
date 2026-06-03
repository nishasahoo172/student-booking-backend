import express from "express";
import {
  createBooking,
  listMyBookings,
  myCredits,
  purchaseHistory,
  creditHistory,
  buyCredits
} from "../controllers/booking.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/credits", requireAuth, myCredits);
router.get("/bookings", requireAuth, listMyBookings);
router.post("/", requireAuth, createBooking);
router.get("/me/purchase-history", requireAuth, purchaseHistory);
// router.get("/purchase-history", requireAuth, purchaseHistory);
router.get("/credit-history", requireAuth, creditHistory);
router.post("/buy-credits", requireAuth, buyCredits);
export default router;
