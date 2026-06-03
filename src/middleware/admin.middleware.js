export default function adminOnly(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }
    next();
  } catch (err) {
    console.error("admin middleware error:", err);
    res.status(500).json({ message: "Server error" });
  }
}
