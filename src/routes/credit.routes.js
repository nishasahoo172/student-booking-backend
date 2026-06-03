import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  myCredits,
  purchaseHistory,
  creditHistory,
  buyCredits
} from "../controllers/credit.controller.js";

const router = express.Router();

router.get("/balance", requireAuth, myCredits);
router.get("/purchase-history", requireAuth, purchaseHistory);
router.get("/ledger", requireAuth, creditHistory);
router.post("/buy", requireAuth, buyCredits);

export default router;
