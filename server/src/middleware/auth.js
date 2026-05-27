import jwt from "jsonwebtoken";

export function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    req.user = { role: "submitter", id: null };
    return next();
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "change-me");
  } catch {
    req.user = { role: "submitter", id: null };
  }

  return next();
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}
