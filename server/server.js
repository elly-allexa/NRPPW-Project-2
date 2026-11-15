import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

//all identities and documents are fictitious. no actual user data or secrets
const users = {
  student: { id: "student", displayName: "Student", role: "USER" },
  admin: { id: "admin", displayName: "Administrator", role: "ADMIN" },
};

const documents = {
  1: {
    id: 1,
    owner: "student",
    title: "Student notes",
    body: "Demo: my course notes.",
  },
  2: {
    id: 2,
    owner: "admin",
    title: "Admin planning document",
    body: "Demo: my system planning document.",
  },
};

const sessions = new Map();

function sessionFromRequest(req) {
  const raw = req.headers.cookie ?? "";
  const token = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("demo_session="))
    ?.slice("demo_session=".length);
  return token ? sessions.get(token) : undefined;
}

function requireSession(req, res, next) {
  const session = sessionFromRequest(req);
  if (!session)
    return res
      .status(401)
      .json({ error: "Log in using a demo account first." });
  req.demoSession = session;
  next();
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 1000,
  };
}

app.post("/api/login", (req, res) => {
  const user = users[req.body?.username];
  if (!user) return res.status(400).json({ error: "Choose student or admin." });

  const token = randomUUID();
  sessions.set(token, { userId: user.id, bacUnsafe: false });

  res.cookie("demo_session", token, cookieOptions());
  res.json({ user, bacUnsafe: false });
});

app.get("/api/session", (req, res) => {
  const s = sessionFromRequest(req);
  res.json(
    s
      ? { user: users[s.userId], bacUnsafe: s.bacUnsafe }
      : { user: null, bacUnsafe: false },
  );
});

app.post("/api/bac-mode", requireSession, (req, res) => {
  if (typeof req.body?.unsafe !== "boolean")
    return res.status(400).json({ error: "unsafe must be boolean" });

  req.demoSession.bacUnsafe = req.body.unsafe;
  res.json({ bacUnsafe: req.demoSession.bacUnsafe });
});

app.get("/api/documents/:id", requireSession, (req, res) => {
  const doc = documents[req.params.id];

  if (!doc) return res.status(404).json({ error: "Document not found." });

  const { userId, bacUnsafe } = req.demoSession;
  const authorized = userId === doc.owner || users[userId]?.role === "ADMIN";

  if (!bacUnsafe && !authorized) {
    return res.status(403).json({
      error: "Forbidden: you do not have permission to read this document.",
      requestedId: doc.id,
    });
  }

  res.json({
    document: doc,
    explanation:
      bacUnsafe && !authorized
        ? "VULNERABLE: ownership check intentionally skipped"
        : "Access allowed by authorization policy",
  });
});

//health check endpoint for load balancers and uptime monitoring
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");

app.use(express.static(distDir));

app.get("/{*path}", (req, res) =>
  res.sendFile(path.join(distDir, "index.html")),
);

const port = Number(process.env.PORT || 3001);

app.listen(port, "0.0.0.0", () =>
  console.log(`Server listening on http://localhost:${port}`),
);
