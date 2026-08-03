import db from "../config/db.js";

/* =========================
   HELPER: Get Balance
========================= */
export async function getUserCredits(userId) {
  const [rows] = await db.execute(
    `
    SELECT COALESCE(SUM(remainingCredits),0) as total
    FROM credit_packages
    WHERE userId = ?
    AND expiryDate > NOW()
    `,
    [userId]
  );

  return rows[0].total || 0;
}
/* =========================
   GET CURRENT BALANCE
========================= */
export async function myCredits(req, res) {
  try {
    const credits = await getUserCredits(req.user.id);
    res.json({ credits });
  } catch (err) {
    console.error("myCredits error:", err);
    res.status(500).json({ message: "Failed to load balance" });
  }
}

/* =========================
   PURCHASE HISTORY
========================= */
export async function purchaseHistory(req, res) {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
  `
  SELECT 
    productName,
    price,
    originalCredits,
    remainingCredits,
    expiryDate,
    createdAt
  FROM credit_packages
  WHERE userId = ?
  ORDER BY createdAt DESC
  `,
  [userId]
);

    res.json(rows);

  } catch (err) {
    console.error("purchaseHistory error:", err);
    res.status(500).json({ message: "Failed to load purchase history" });
  }
}

/* =========================
   CREDIT LEDGER HISTORY
========================= */
export async function creditHistory(req, res) {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
      `
      SELECT id, delta, reason, createdAt
      FROM credit_ledger
      WHERE userId=?
      ORDER BY createdAt DESC
      `,
      [userId]
    );

    const credits = await getUserCredits(userId);
    res.json({
      credits,
      history: rows
    });

  } catch (err) {
    console.error("creditHistory error:", err);
    res.status(500).json({ message: "Failed to load credit history" });
  }
}

/* =========================
   BUY CREDITS
========================= */
export async function buyCredits(req, res) {
  try {
    const userId = req.user.id;
    const { credits, price } = req.body;

    if (!credits || credits <= 0) {
      return res.status(400).json({ message: "Invalid credit amount" });
    }

    const expiry = new Date();
   expiry.setMonth(expiry.getMonth() + 4);

    // 1️⃣ Insert into credit_packages
    // Insert into credit_packages


await db.execute(
  `
  UPDATE users
  SET credits =
  (
    SELECT COALESCE(
      SUM(remainingCredits),
      0
    )
    FROM credit_packages
    WHERE userId = ?
    AND expiryDate > NOW()
  )
  WHERE id = ?
  `,
  [userId, userId]
);


const [pkg] = await db.execute(
  `
  INSERT INTO credit_packages
  (userId, productName, originalCredits, remainingCredits, price, expiryDate)
  VALUES (?, ?, ?, ?, ?, ?)
  `,
  [
    userId,
    "Starter Pack",
    credits,
    credits,     // remainingCredits = full credits initially
    price || 0,
    expiry
  ]
);

    // 2️⃣ Insert into ledger
    await db.execute(
      `
      INSERT INTO credit_ledger (userId, bookingId, delta, reason)
      VALUES (?, NULL, ?, 'Credit Purchase')
      `,
      [userId, credits]
    );

    res.json({
      message: "Credits purchased successfully",
      packageId: pkg.insertId
    });

  } catch (err) {
    console.error("buyCredits error:", err);
    res.status(500).json({ message: "Failed to purchase credits" });
  }
}
