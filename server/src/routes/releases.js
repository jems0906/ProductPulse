import express from "express";

import { hasDatabase, query } from "../db/pool.js";
import { createMilestone, createRelease, listMilestones, listReleases } from "../db/demo-store.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    if (!hasDatabase) {
      return res.json({
        releases: listReleases(),
        milestones: listMilestones(),
      });
    }

    const releases = await query(
      `
      SELECT id, title, summary, shipped_at, version, status
      FROM releases
      ORDER BY COALESCE(shipped_at, NOW()) DESC
      `,
    );

    const milestones = await query(
      `
      SELECT id, name, target_date, status
      FROM milestones
      ORDER BY target_date ASC
      `,
    );

    return res.json({
      releases: releases.rows,
      milestones: milestones.rows,
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/", requireRole(["product_owner", "admin"]), async (req, res, next) => {
  try {
    const { title, summary, version, shippedAt, status = "planned" } = req.body;

    if (!title || !version) {
      return res.status(400).json({ message: "Title and version are required" });
    }

    if (!hasDatabase) {
      return res.status(201).json(
        createRelease({
          title,
          summary,
          version,
          shippedAt: shippedAt || null,
          status,
        }),
      );
    }

    const inserted = await query(
      `
      INSERT INTO releases (title, summary, version, shipped_at, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [title, summary || "", version, shippedAt || null, status],
    );

    return res.status(201).json(inserted.rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.post("/milestones", requireRole(["product_owner", "admin"]), async (req, res, next) => {
  try {
    const { name, targetDate, status = "planned" } = req.body;

    if (!name || !targetDate) {
      return res.status(400).json({ message: "Name and targetDate are required" });
    }

    if (!hasDatabase) {
      return res.status(201).json(createMilestone({ name, targetDate, status }));
    }

    const inserted = await query(
      `
      INSERT INTO milestones (name, target_date, status)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [name, targetDate, status],
    );

    return res.status(201).json(inserted.rows[0]);
  } catch (err) {
    return next(err);
  }
});

export default router;
