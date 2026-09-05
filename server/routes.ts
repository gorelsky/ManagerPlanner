import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { runDatabaseMigrations } from "./migrations";
import {
  insertUserSchema,
  insertCitySchema,
  insertEmployeeSchema,
  insertActivityTypeSchema,
  insertActivitySchema,
  updateActivitySchema,
  insertMessageSchema,
  ACTIVITY_STATUSES,
} from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import bcrypt from "bcrypt";
import { changePasswordSchema } from "./passwords";

// ===================== Типы и расширения =====================

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        username: string;
      };
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    loginSessionId?: string;
    lastActivityTrackedAt?: number;
  }
}

// ===================== Middleware =====================

async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      id: user.id,
      role: user.role || "user",
      username: user.username,
    };

    const now = Date.now();
    if (
      req.session.loginSessionId &&
      (!req.session.lastActivityTrackedAt ||
        now - req.session.lastActivityTrackedAt >= 60_000)
    ) {
      try {
        await storage.touchLoginSession(req.session.loginSessionId);
        req.session.lastActivityTrackedAt = now;
      } catch (error) {
        console.error("Login session activity tracking error:", error);
      }
    }
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "admin" && req.user.role !== "director") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

function requireManagerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!["admin", "director", "manager", "hr_director"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

function requireSystemAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Действие доступно только администратору" });
  }
  next();
}

function requirePlanEditor(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!["admin", "director", "manager"].includes(req.user.role)) {
    return res.status(403).json({ message: "Роль HR-директора доступна только для просмотра" });
  }
  next();
}

function requireAllPlansViewer(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!["admin", "director", "hr_director"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

// ===================== Вспомогательные функции =====================

function parseDateFields<T extends Record<string, any>>(
  body: T,
  fields: (keyof T)[]
): T {
  const result = { ...body };
  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      const date = new Date(result[field] as string);
      if (!isNaN(date.getTime())) {
        result[field] = date as any;
      } else {
        throw new Error(`Invalid date for field ${String(field)}`);
      }
    }
  }
  return result;
}

const activityStatusSchema = z.object({
  status: z.enum(ACTIVITY_STATUSES),
});

const activityApprovalSchema = z.object({
  approvalStatus: z.enum(["approved", "rejected"]),
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

// ===================== Регистрация маршрутов =====================

export async function registerRoutes(app: Express): Promise<Server> {
  await runDatabaseMigrations();

  try {
    await storage.initializeUsers();
    await storage.initializeCities();
    await storage.initializeActivityTypes();
  } catch (error) {
    console.error("Failed to initialize data:", error);
  }

  // ----- Публичные маршруты (не требуют аутентификации) -----

  // Логин по локальной БД (оставлен для обратной совместимости)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Неверный логин или пароль" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Неверный логин или пароль" });
      }

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((error) => (error ? reject(error) : resolve()));
      });
      const loginSession = await storage.createLoginSession(user);
      req.session.userId = user.id;
      req.session.loginSessionId = loginSession.id;
      req.session.lastActivityTrackedAt = Date.now();
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Логин и пароль обязательны" });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Внутренняя ошибка сервера" });
    }
  });

  // Выход
  app.post("/api/auth/logout", async (req, res) => {
    const loginSessionId = req.session.loginSessionId;
    if (loginSessionId) {
      try {
        await storage.endLoginSession(loginSessionId);
      } catch (error) {
        console.error("Login session completion error:", error);
      }
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Ошибка выхода" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Выход выполнен" });
    });
  });

  // ----- Все остальные маршруты требуют аутентификации -----
  app.use("/api", authenticate);

  app.get("/api/auth/me", async (req, res) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }
    const { password: _, ...publicUser } = user;
    res.json(publicUser);
  });

  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const user = await storage.getUser(req.user!.id);

      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(400).json({ message: "Текущий пароль указан неверно" });
      }

      await storage.updateUserPassword(user.id, newPassword, false);
      res.json({ message: "Пароль успешно изменён" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Проверьте новый пароль" });
      }
      console.error("Change password error:", error);
      res.status(500).json({ message: "Не удалось изменить пароль" });
    }
  });

  app.get("/api/login-sessions", requireSystemAdmin, async (req, res) => {
    try {
      const requestedLimit = Number(req.query.limit ?? 200);
      const limit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500)
        : 200;
      const loginSessions = await storage.getLoginSessions(limit);
      res.json(loginSessions);
    } catch (error) {
      console.error("Get login sessions error:", error);
      res.status(500).json({ message: "Не удалось загрузить журнал входов" });
    }
  });

  // ----- Маршруты для администраторов -----
  app.post("/api/employees/import", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "Invalid CSV data" });
      }
      const result = await storage.importEmployees(csvData);
      res.json(result);
    } catch (error) {
      console.error("Import employees error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users/import", requireAdmin, async (req, res) => {
    try {
      const { csvData, role } = req.body;
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "Invalid CSV data" });
      }
      const importRole = role === "admin" ? "admin" : "manager";
      const result = await storage.importUsersFromCsv(csvData, importRole);
      res.json(result);
    } catch (error) {
      console.error("Import users error:", error);
      res.status(500).json({ message: "Internal server error during users import" });
    }
  });

  app.post("/api/cities/import", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "Invalid CSV data" });
      }
      const result = await storage.importCities(csvData);
      res.json(result);
    } catch (error) {
      console.error("Import cities error:", error);
      res.status(500).json({ message: "Internal server error during cities import" });
    }
  });

  app.post("/api/manager-cities/import", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "Invalid CSV data" });
      }
      const result = await storage.importManagerCitiesFromCsv(csvData);
      res.json(result);
    } catch (error) {
      console.error("Import manager cities error:", error);
      res.status(500).json({ message: "Internal server error during manager cities import" });
    }
  });

  app.post("/api/holidays/import", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "Invalid CSV data" });
      }
      const result = await storage.importHolidaysFromCsv(csvData);
      res.json(result);
    } catch (error) {
      console.error("Import holidays error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      await storage.deleteUser(id);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      const { password: _, ...publicUser } = user;
      res.status(201).json(publicUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      console.error("Create user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----- Маршруты для менеджеров и администраторов -----
  app.get("/api/users/managers", requireManagerOrAdmin, async (_req, res) => {
    try {
      const managers = await storage.getManagersList();
      res.json(managers.map(({ password: _, ...manager }) => manager));
    } catch (error) {
      console.error("Get managers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...publicUser } = user;
      res.json(publicUser);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/cities", async (_req, res) => {
    try {
      const cities = await storage.getCities();
      res.json(cities);
    } catch (error) {
      console.error("Get cities error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/cities", requireAdmin, async (req, res) => {
    try {
      const cityData = insertCitySchema.parse(req.body);
      const city = await storage.createCity(cityData);
      res.status(201).json(city);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid city data", errors: error.errors });
      }
      console.error("Create city error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/cities/manager/:managerId", requireManagerOrAdmin, async (req, res) => {
    try {
      const cities = await storage.getCitiesByManager(req.params.managerId);
      res.json(cities);
    } catch (error) {
      console.error("Get manager cities error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----- Маршруты для сотрудников -----
  app.get("/api/employees/all", requireManagerOrAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
      const employees = await storage.getAllEmployees(limit, offset);
      res.json(employees);
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/employees/manager/:managerId", requireManagerOrAdmin, async (req, res) => {
    try {
      const employees = await storage.getEmployeesByManager(req.params.managerId);
      res.json(employees);
    } catch (error) {
      console.error("Get employees by manager error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/employees", requireAdmin, async (req, res) => {
    try {
      const employeeData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(employeeData);
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      }
      console.error("Create employee error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/employees/:id/maternity", requireSystemAdmin, async (req, res) => {
    try {
      const { isOnMaternityLeave } = z
        .object({ isOnMaternityLeave: z.boolean() })
        .parse(req.body);
      const employee = await storage.updateEmployeeMaternityStatus(
        req.params.id,
        isOnMaternityLeave,
      );
      if (!employee) {
        return res.status(404).json({ message: "Медицинский представитель не найден" });
      }
      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Некорректное значение признака декрета" });
      }
      console.error("Update employee maternity status error:", error);
      res.status(500).json({ message: "Не удалось изменить признак декрета" });
    }
  });

  app.get("/api/manager-cities/all", requireAdmin, async (_req, res) => {
    try {
      const assignments = await storage.getAllManagerCities();
      res.json(assignments);
    } catch (error) {
      console.error("Get manager cities error:", error);
      res.status(500).json({ message: "Не удалось загрузить города менеджеров" });
    }
  });

  app.delete("/api/employees/:id", requireSystemAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteEmployee(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Медицинский представитель не найден" });
      }
      res.status(204).end();
    } catch (error) {
      console.error("Delete employee error:", error);
      res.status(500).json({ message: "Не удалось удалить медицинского представителя" });
    }
  });

  // ----- Маршруты для типов активностей -----
  app.get("/api/activity-types", async (_req, res) => {
    try {
      const activityTypes = await storage.getActivityTypes();
      res.json(activityTypes);
    } catch (error) {
      console.error("Get activity types error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/activity-types", requireAdmin, async (req, res) => {
    try {
      const activityTypeData = insertActivityTypeSchema.parse(req.body);
      const activityType = await storage.createActivityType(activityTypeData);
      res.status(201).json(activityType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity type data", errors: error.errors });
      }
      console.error("Create activity type error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----- Маршруты для активностей -----
  app.get("/api/activities/all", requireAllPlansViewer, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const activities = await storage.getAllActivities(startDate, endDate, limit, offset);
      res.json(activities);
    } catch (error) {
      console.error("Get activities error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/activities/user/:userId", requireManagerOrAdmin, async (req, res) => {
    try {
      if (req.user?.role === "manager" && req.params.userId !== req.user.id) {
        return res.status(403).json({ message: "Нельзя просматривать чужие планы" });
      }
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const activities = await storage.getActivitiesByUser(
        req.params.userId,
        startDate,
        endDate
      );
      res.json(activities);
    } catch (error) {
      console.error("Get user activities error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/activities/:id", async (req, res) => {
    try {
      const activity = await storage.getActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      if (req.user?.role === "manager" && activity.userId !== req.user.id) {
        return res.status(403).json({ message: "Нельзя просматривать чужой план" });
      }
      res.json(activity);
    } catch (error) {
      console.error("Get activity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/activities", requirePlanEditor, async (req, res) => {
    try {
      const body = parseDateFields(req.body, ["startDate", "endDate"]);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const startDate = new Date(body.startDate);
      startDate.setHours(0, 0, 0, 0);
      if (startDate < now) {
        return res.status(400).json({ message: "Нельзя добавлять активности задним числом" });
      }
      if (body.startDate && body.endDate && body.startDate >= body.endDate) {
        return res.status(400).json({ message: "Дата окончания должна быть позже даты начала" });
      }
      const activityData = insertActivitySchema.parse({
        ...body,
        userId: req.user?.role === "manager" ? req.user.id : body.userId,
        status: "planned",
      });
      const activity = await storage.createActivity(activityData);
      res.status(201).json(activity);
    } catch (error) {
      console.error("Create activity error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "Дата окончания должна быть позже даты начала" ||
            error.message === "Пересечение по времени. Повторите планирование") {
          return res.status(400).json({ message: error.message });
        }
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/activities/:id", requirePlanEditor, async (req, res) => {
    try {
      const id = req.params.id;
      const existing = await storage.getActivity(id);
      if (!existing) {
        return res.status(404).json({ message: "Activity not found" });
      }
      if (req.user?.role === "manager" && existing.userId !== req.user.id) {
        return res.status(403).json({ message: "Нельзя изменять чужой план" });
      }
      if (existing.status === "completed") {
        return res.status(400).json({ message: "Выполненный план нельзя редактировать" });
      }
      const raw = req.body;
      const dataToValidate = parseDateFields(raw, ["startDate", "endDate"]);
      if (req.user?.role === "manager") {
        delete dataToValidate.userId;
        delete dataToValidate.status;
      }
      if (dataToValidate.startDate && dataToValidate.endDate && dataToValidate.startDate >= dataToValidate.endDate) {
        return res.status(400).json({ message: "Дата окончания должна быть позже даты начала" });
      }
      const data = updateActivitySchema.parse(dataToValidate);
      const activity = await storage.updateActivity(id, data);
      res.json(activity);
    } catch (error) {
      console.error("Update activity error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "Дата окончания должна быть позже даты начала" ||
            error.message === "Пересечение по времени. Повторите планирование") {
          return res.status(400).json({ message: error.message });
        }
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/activities/:id/status", requirePlanEditor, async (req, res) => {
    try {
      const id = req.params.id;
      const { status } = activityStatusSchema.parse(req.body);
      const existing = await storage.getActivity(id);
      if (!existing) {
        return res.status(404).json({ message: "Activity not found" });
      }
      if (existing.userId !== req.user?.id) {
        return res.status(403).json({ message: "Только автор плана может изменить выполнение" });
      }
      if (status === "completed") {
        if (existing.approvalStatus !== "approved") {
          return res.status(400).json({ message: "Сначала план должен утвердить директор" });
        }
        const now = new Date();
        const endDateTime = new Date(existing.endDate);
        if (now.getTime() < endDateTime.getTime()) {
          return res.status(400).json({ message: "Нельзя завершить активность раньше времени окончания" });
        }
      }
      const activity = await storage.updateActivityStatus(id, status);
      res.json(activity);
    } catch (error) {
      console.error("Update activity status error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status value", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/activities/:id/approval", requireAdmin, async (req, res) => {
    try {
      const { approvalStatus } = activityApprovalSchema.parse(req.body);
      const existing = await storage.getActivity(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Activity not found" });
      }
      if (existing.status === "completed") {
        return res.status(400).json({ message: "Выполненный план нельзя пересогласовать" });
      }

      const activity = await storage.updateActivityApproval(
        req.params.id,
        approvalStatus,
        req.user!.id,
      );
      res.json(activity);
    } catch (error) {
      console.error("Update activity approval error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Недопустимое решение по плану", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/activities/:id", requirePlanEditor, async (req, res) => {
    try {
      const existing = await storage.getActivity(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Activity not found" });
      }
      if (req.user?.role === "manager" && existing.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteActivity(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error("Delete activity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/activities/calendar/user/:userId", requireManagerOrAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate и endDate обязательны для календаря" });
      }
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      const stats = await storage.getActivityCalendarStatsByUser(req.params.userId, start, end);
      res.json({ items: stats });
    } catch (error) {
      console.error("Calendar stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----- Маршруты для сообщений -----
  app.get("/api/messages/:userId", requireManagerOrAdmin, async (req, res) => {
    try {
      if (req.params.userId !== req.user?.id) {
        return res.status(403).json({ message: "Нельзя читать сообщения от имени другого пользователя" });
      }
      const userId = req.user.id;
      const messages = await storage.getMessages(userId);
      const formatted = messages.map((message) => ({
        ...message,
        createdAt: message.createdAt
          ? format(message.createdAt, "'отправлено' dd.MM.yyyy 'в' HH:mm", { locale: ru })
          : null,
      }));
      res.json(formatted);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages", requireManagerOrAdmin, async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse({
        ...req.body,
        senderId: req.user!.id,
      });
      const message = await storage.createMessage(messageData);
      const formatted = {
        ...message,
        createdAt: message.createdAt
          ? format(message.createdAt, "'отправлено' dd.MM.yyyy 'в' HH:mm", { locale: ru })
          : null,
      };
      res.status(201).json(formatted);
    } catch (error) {
      console.error("Create message error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/messages/:messageId/read", requireManagerOrAdmin, async (req, res) => {
    try {
      await storage.markMessageAsRead(req.params.messageId);
      res.status(204).send();
    } catch (error) {
      console.error("Mark message as read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----- Праздничные дни -----
  app.get("/api/holidays/all", requireAdmin, async (_req, res) => {
    try {
      const allHolidays = await storage.getAllHolidays();
      res.json(allHolidays);
    } catch (error) {
      console.error("Get all holidays error:", error);
      res.status(500).json({ message: "Не удалось загрузить праздничные дни" });
    }
  });

  app.get("/api/holidays", async (req, res) => {
    try {
      const yearParam = req.query.year;
      const year = typeof yearParam === "string" ? parseInt(yearParam, 10) : NaN;
      if (!year || isNaN(year)) {
        return res.status(400).json({ message: "Invalid or missing year parameter" });
      }
      const holidays = await storage.getHolidaysByYear(year);
      res.json(holidays);
    } catch (error) {
      console.error("Get holidays error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----- Создание HTTP-сервера -----
  const httpServer = createServer(app);
  return httpServer;
}
