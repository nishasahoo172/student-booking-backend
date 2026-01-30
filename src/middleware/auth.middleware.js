import jwt from "jsonwebtoken";

export default function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;

  if (!token) return res.status(401).json({ message: "Please login" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email }
    return next();
  } catch {
    return res.status(401).json({ message: "Please login" });
  }
}
