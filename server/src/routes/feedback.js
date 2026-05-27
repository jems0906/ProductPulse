import express from "express";
import { z } from "zod";

import { hasDatabase, query } from "../db/pool.js";
import {
  addVote,
  createComment,
  createFeedback,
  listComments,
  listFeedback,
  listUsers,
  updateFeedback as updateFeedbackDemo,
} from "../db/demo-store.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

const feedbackSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  tags: z.array(z.string()).optional(),
});

router.get("/", async (req, res, next) => {
  try {
    if (!hasDatabase) {
      return res.json(listFeedback(req.query));
    }

    const { search = "", status, priority, tag, assignee, sort = "newest" } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(f.title ILIKE $${params.length} OR f.description ILIKE $${params.length})`);
    }

    if (status) {
      params.push(status);
      conditions.push(`f.status = $${params.length}`);
    }

    if (priority) {
      params.push(priority);
      conditions.push(`f.priority = $${params.length}`);
    }

    if (tag) {
      params.push(tag);
      conditions.push(`$${params.length} = ANY(f.tags)`);
    }

    if (assignee) {
      params.push(assignee);
      conditions.push(`COALESCE(u.name, '') ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const orderBy =
      sort === "mostRequested"
        ? "vote_count DESC, f.created_at DESC"
        : sort === "oldest"
          ? "f.created_at ASC"
          : "f.created_at DESC";

    const sql = `
      SELECT
        f.id,
        f.title,
        f.description,
        f.status,
        f.priority,
        f.tags,
        f.created_at,
        f.updated_at,
        COALESCE(u.name, 'Unassigned') AS assignee,
        f.created_by,
        COALESCE(v.vote_count, 0) AS vote_count
      FROM feedback_requests f
      LEFT JOIN users u ON u.id = f.assigned_to
      LEFT JOIN (
        SELECT feedback_id, COUNT(*)::int AS vote_count
        FROM feedback_votes
        GROUP BY feedback_id
      ) v ON v.feedback_id = f.id
      ${where}
      ORDER BY ${orderBy}
    `;

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (err) {
    return next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = feedbackSchema.parse(req.body);
    const userId = req.user?.id;

    if (!hasDatabase) {
      return res.status(201).json(
        createFeedback({
          title: parsed.title,
          description: parsed.description,
          tags: parsed.tags || [],
          createdBy: userId,
        }),
      );
    }

    const inserted = await query(
      `
      INSERT INTO feedback_requests (title, description, tags, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [parsed.title, parsed.description, parsed.tags || [], userId],
    );

    return res.status(201).json(inserted.rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation failed", issues: err.issues });
    }

    return next(err);
  }
});

router.patch("/:id", requireRole(["product_owner", "admin"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, priority, tags, assignedTo } = req.body;

    if (!hasDatabase) {
      const updated = updateFeedbackDemo(id, { status, priority, tags, assignedTo });

      if (!updated) {
        return res.status(404).json({ message: "Feedback not found" });
      }

      return res.json(updated);
    }

    const updated = await query(
      `
      UPDATE feedback_requests
      SET
        status = COALESCE($1, status),
        priority = COALESCE($2, priority),
        tags = COALESCE($3, tags),
        assigned_to = COALESCE($4, assigned_to),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [status || null, priority || null, tags || null, assignedTo || null, id],
    );

    if (!updated.rowCount) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    return res.json(updated.rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.post("/:id/comments", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body } = req.body;

    if (!body) {
      return res.status(400).json({ message: "Comment body is required" });
    }

    if (!hasDatabase) {
      return res.status(201).json(createComment(id, req.user?.id || null, body));
    }

    const inserted = await query(
      `
      INSERT INTO feedback_comments (feedback_id, author_id, body)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [id, req.user?.id || null, body],
    );

    return res.status(201).json(inserted.rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.get("/:id/comments", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!hasDatabase) {
      return res.json(listComments(id));
    }

    const result = await query(
      `
      SELECT c.id, c.body, c.created_at, COALESCE(u.name, 'Anonymous') AS author
      FROM feedback_comments c
      LEFT JOIN users u ON u.id = c.author_id
      WHERE c.feedback_id = $1
      ORDER BY c.created_at DESC
      `,
      [id],
    );

    return res.json(result.rows);
  } catch (err) {
    return next(err);
  }
});

router.post("/:id/vote", async (req, res, next) => {
  try {
    const { id } = req.params;
    const voterId = req.user?.id;

    if (!voterId) {
      return res.status(401).json({ message: "Login required to vote" });
    }

    if (!hasDatabase) {
      addVote(id, voterId);
      return res.json({ message: "Vote recorded" });
    }

    await query(
      `
      INSERT INTO feedback_votes (feedback_id, voter_id)
      VALUES ($1, $2)
      ON CONFLICT (feedback_id, voter_id) DO NOTHING
      `,
      [id, voterId],
    );

    return res.json({ message: "Vote recorded" });
  } catch (err) {
    return next(err);
  }
});

router.get("/meta/users", requireRole(["product_owner", "admin"]), async (_req, res, next) => {
  try {
    if (!hasDatabase) {
      return res.json(listUsers());
    }

    const users = await query("SELECT id, name, role FROM users ORDER BY name");
    return res.json(users.rows);
  } catch (err) {
    return next(err);
  }
});

export default router;
