import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { supabase } from "./supabase";
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
  }
}

// ===================== Middleware =====================

async function authenticate(req: Request, res: Response, next: NextFunction) {
  console.log("[Authenticate] Session ID:", req.sessionID);
  console.log("[Authenticate] Session data:", req.session);
  console.log("[Authenticate] userId:", req.session?.userId);
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
  if (req.user.role !== "admin" && req.user.role !== "director" && req.user.role !== "manager") {
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

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// ===================== Регистрация маршрутов =====================

export async function registerRoutes(app: Express): Promise<Server> {
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
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Логин и пароль обязательны" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Неверный логин или пароль" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Неверный логин или пароль" });
      }

      req.session.userId = user.id;
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Внутренняя ошибка сервера" });
    }
  });

  // Выход
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Ошибка выхода" });
      }
      res.json({ message: "Выход выполнен" });
    });
  });

  // Вход через Supabase (по токену)
app.post("/api/auth/supabase", async (req, res) => {
  try {
    const { access_token } = req.body;
    console.log("[Supabase login] Token received:", access_token ? "yes" : "no");
    if (!access_token) {
      return res.status(400).json({ message: "Токен не предоставлен" });
    }

    // Проверяем токен через Auth API
    const response = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        apikey: process.env.VITE_SUPABASE_ANON_KEY!,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[Supabase login] Auth API error:", response.status, text);
      return res.status(401).json({ message: "Неверный токен" });
    }

    const user = await response.json();
    console.log("[Supabase login] User verified:", user.id, user.email);

    // 1. Ищем по email (username)
    let localUser = await storage.getUserByUsername(user.email);
    // 2. Если не найден, ищем по id (на случай, если уже есть запись с таким id)
    if (!localUser) {
      localUser = await storage.getUser(user.id);
    }
    // 3. Если всё ещё не найден – создаём нового
    if (!localUser) {
      console.log("[Supabase login] Creating new local user for:", user.id);
      localUser = await storage.createUser({
        id: user.id,
        username: user.email,
        password: "",
        firstName: user.user_metadata?.first_name || "",
        lastName: user.user_metadata?.last_name || "",
        middleName: user.user_metadata?.middle_name || "",
        role: "manager",
        profileImage: user.user_metadata?.avatar_url || "",
      });
    } else {
      console.log("[Supabase login] Local user found:", localUser.id);
      // Если найден по username, но id отличается – можно обновить id (опционально)
      // Но чтобы не трогать связанные данные, оставляем как есть
      // Сессию будем создавать с localUser.id
    }

    // Устанавливаем сессию
    req.session.userId = localUser.id;
    req.session.save((err) => {
      if (err) {
        console.error("[Supabase login] Session save error:", err);
        return res.status(500).json({ message: "Ошибка сохранения сессии" });
      }
      console.log("[Supabase login] Session saved for user:", localUser.id);
      const { password: _, ...userWithoutPassword } = localUser;
      res.json(userWithoutPassword);
    });
  } catch (error) {
    console.error("[Supabase login] Error:", error);
    res.status(500).json({ message: "Внутренняя ошибка сервера" });
  }
});

  // ----- Все остальные маршруты требуют аутентификации -----
  app.use("/api", authenticate);

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
      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });
      res.status(201).json(user);
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
      res.json(managers);
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
      res.json(user);
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
  app.get("/api/activities/all", requireManagerOrAdmin, async (req, res) => {
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
      res.json(activity);
    } catch (error) {
      console.error("Get activity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/activities", requireManagerOrAdmin, async (req, res) => {
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
      const activityData = insertActivitySchema.parse(body);
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

  app.patch("/api/activities/:id", requireManagerOrAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const raw = req.body;
      const dataToValidate = parseDateFields(raw, ["startDate", "endDate"]);
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

  app.patch("/api/activities/:id/status", requireManagerOrAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const { status } = activityStatusSchema.parse(req.body);
      const existing = await storage.getActivity(id);
      if (!existing) {
        return res.status(404).json({ message: "Activity not found" });
      }
      if (status === "completed") {
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

  app.delete("/api/activities/:id", requireManagerOrAdmin, async (req, res) => {
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
      const userId = req.params.userId;
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
      const messageData = insertMessageSchema.parse(req.body);
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
