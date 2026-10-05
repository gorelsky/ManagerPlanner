import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error("SESSION_SECRET must contain at least 32 characters in production");
}

// Railway terminates HTTPS at its proxy. Trust it so secure cookies work.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

// Ограничиваем размер входящих данных
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Настройка сессий
const PgStore = pgSession(session);
app.use(
  session({
    // Yandex Serverless Container terminates HTTPS at its edge proxy. Keep
    // express-session aware of that proxy so Secure cookies are emitted even
    // when the container itself receives an internal HTTP request.
    proxy: true,
    store: new PgStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: sessionSecret || "development-only-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      // OIDC returns through a different site (auth.yandex.cloud). None is
      // required for the freshly regenerated session cookie to survive that
      // cross-site redirect in all supported browsers.
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 неделя
    },
  })
);

// Log request metadata only. Response bodies may contain personal data.
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

app.get("/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    status: "ok",
    uptime: Math.round(process.uptime()),
  });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ status: "ok", database: "ok" });
  } catch (error) {
    console.error("Readiness database check failed:", error);
    res.status(503).json({ status: "unavailable", database: "error" });
  }
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message =
      isProduction && status >= 500
        ? "Внутренняя ошибка сервера"
        : err.message || "Internal Server Error";

    console.error("Global error handler:", err);
    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5002", 10);
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => {
    console.log(`Сервер запущен на http://${host}:${port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Получен ${signal}, завершаем работу сервера`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
})();
