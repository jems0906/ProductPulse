import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";

import { hasDatabase, query } from "../db/pool.js";
import { loginUser } from "../db/demo-store.js";

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!hasDatabase) {
      const user = loginUser(email, password);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, email: user.email, name: user.name },
        process.env.JWT_SECRET || "change-me",
        { expiresIn: "8h" },
      );

      return res.json({ token, user });
    }

    const result = await query("SELECT id, name, email, role, password_hash FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isHashed = user.password_hash?.startsWith("$2");
    const validPassword = isHashed
      ? await bcrypt.compare(password, user.password_hash)
      : password === user.password_hash;

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET || "change-me",
      { expiresIn: "8h" },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
