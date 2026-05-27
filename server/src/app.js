import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import analyticsRouter from "./routes/analytics.js";
import authRouter from "./routes/auth.js";
import feedbackRouter from "./routes/feedback.js";
import releaseRouter from "./routes/releases.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "../../client");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(authenticate);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "ProductPulse API" });
});

app.use("/api/auth", authRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/releases", releaseRouter);
app.use("/api/analytics", analyticsRouter);

app.use(express.static(clientDir));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  return res.sendFile(path.join(clientDir, "index.html"));
});

app.use(notFound);
app.use(errorHandler);

export default app;
