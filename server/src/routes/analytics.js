import express from "express";

import { hasDatabase, query } from "../db/pool.js";
import { analyticsOverview } from "../db/demo-store.js";

const router = express.Router();

router.get("/overview", async (_req, res, next) => {
  try {
    if (!hasDatabase) {
      return res.json(analyticsOverview());
    }

    const stateCounts = await query(
      `
      SELECT status, COUNT(*)::int AS count
      FROM feedback_requests
      GROUP BY status
      `,
    );

    const topRequested = await query(
      `
      SELECT f.id, f.title, COUNT(v.*)::int AS votes
      FROM feedback_requests f
      LEFT JOIN feedback_votes v ON v.feedback_id = f.id
      GROUP BY f.id
      ORDER BY votes DESC, f.created_at DESC
      LIMIT 5
      `,
    );

    const velocity = await query(
      `
      SELECT DATE_TRUNC('week', shipped_at)::date AS week, COUNT(*)::int AS releases
      FROM releases
      WHERE shipped_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY week
      ORDER BY week ASC
      `,
    );

    return res.json({
      states: stateCounts.rows,
      mostRequested: topRequested.rows,
      releaseVelocity: velocity.rows,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
