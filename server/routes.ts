import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertCitySchema,
  insertEmployeeSchema,
  insertActivityTypeSchema,
  insertActivitySchema,
  updateActivitySchema,
  insertMessageSchema,
} from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    await storage.initializeUsers();
    await storage.initializeCities();
    await storage.initializeActivityTypes();
  } catch (error) {
    console.error("Failed to initialize data:", error);
  }

  // Authentication
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

      if (user.password !== password) {
        return res.status(401).json({ message: "Неверный логин или пароль" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Внутренняя ошибка сервера" });
    }
  });

  // Users
  app.get("/api/users/managers", async (_req, res) => {
    try {
      const managers = await storage.getManagersList();
      res.json(managers);
    } catch (error) {
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
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
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

  // Cities
  app.get("/api/cities", async (_req, res) => {
    try {
      const cities = await storage.getCities();
      res.json(cities);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/cities", async (req, res) => {
    try {
      const cityData = insertCitySchema.parse(req.body);
      const city = await storage.createCity(cityData);
      res.status(201).json(city);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid city data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/cities/import", async (req, res) => {
    try {
      const { csvData } = req.body as { csvData?: string };
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "Invalid CSV data" });
      }

      const result = await storage.importCities(csvData);
      res.json(result);
    } catch (error) {
      console.error("[IMPORT CITIES ERROR]", error);
      res
        .status(500)
        .json({ message: "Internal server error during cities import" });
    }
  });

  app.get("/api/cities/manager/:managerId", async (req, res) => {
    try {
      const cities = await storage.getCitiesByManager(req.params.managerId);
      res.json(cities);
    } catch (error) {
      console.error("Error fetching manager cities:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/manager-cities/import", async (req, res) => {
    try {
      const { csvData } = req.body as { csvData?: string };
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "Invalid CSV data" });
      }

      const result = await storage.importManagerCitiesFromCsv(csvData);
      res.json(result);
    } catch (error) {
      console.error("[IMPORT MANAGER CITIES ERROR]", error);
      res
        .status(500)
        .json({
          message: "Internal server error during manager cities import",
        });
    }
  });

  // Employees
  app.get("/api/employees/all", async (_req, res) => {
    try {
      const employees = await storage.getAllEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/employees/manager/:managerId", async (req, res) => {
    try {
      const employees = await storage.getEmployeesByManager(
        req.params.managerId,
      );
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/employees/import", async (req, res) => {
    try {
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "Invalid CSV data" });
      }
      const result = await storage.importEmployees(csvData);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users/import", async (req, res) => {
    try {
      const { csvData, role } = req.body;
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "Invalid CSV data" });
      }

      const importRole = role === "admin" ? "admin" : "manager";
      const result = await storage.importUsersFromCsv(csvData, importRole);
      res.json(result);
    } catch (error) {
      console.error("[IMPORT USERS ERROR]", error);
      res
        .status(500)
        .json({
          message: "Internal server error during users import",
        });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const employeeData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(employeeData);
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            message: "Invalid employee data",
            errors: error.errors,
          });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Импорт праздничных дней из CSV
  app.post("/api/holidays/import", async (req, res) => {
    try {
      const { csvData } = req.body;

      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "Invalid CSV data" });
      }

      const result = await storage.importHolidaysFromCsv(csvData);
      return res.status(200).json(result);
    } catch (error) {
      console.error("IMPORT HOLIDAYS ERROR", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Получить праздничные дни за год: GET /api/holidays?year=2026
  app.get("/api/holidays", async (req, res) => {
    try {
      const yearParam = req.query.year;
      const year =
        typeof yearParam === "string" ? parseInt(yearParam, 10) : NaN;

      if (!year || Number.isNaN(year)) {
        return res
          .status(400)
          .json({ message: "Invalid or missing year parameter" });
      }

      const rows = await storage.getHolidaysByYear(year);
      return res.status(200).json(rows);
    } catch (error) {
      console.error("GET HOLIDAYS ERROR", error);
      return res.status(500).json({
        message: "Internal server error",
        error: (error as Error).message,
      });
    }
  });

  // Activity Types
  app.get("/api/activity-types", async (_req, res) => {
    try {
      const activityTypes = await storage.getActivityTypes();
      res.json(activityTypes);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/activity-types", async (req, res) => {
    try {
      const activityTypeData = insertActivityTypeSchema.parse(req.body);
      const activityType =
        await storage.createActivityType(activityTypeData);
      res.status(201).json(activityType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            message: "Invalid activity type data",
            errors: error.errors,
          });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Activities
  app.get("/api/activities/all", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate
        ? new Date(startDate as string)
        : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const activities = await storage.getAllActivities(start, end);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/activities/user/:userId", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate
        ? new Date(startDate as string)
        : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const activities = await storage.getActivitiesByUser(
        req.params.userId,
        start,
        end,
      );
      res.json(activities);
    } catch (error) {
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
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/activities", async (req, res) => {
    try {
      const body = req.body;

      if (body.startDate) body.startDate = new Date(body.startDate);
      if (body.endDate) body.endDate = new Date(body.endDate);

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const startDate = new Date(body.startDate);
      startDate.setHours(0, 0, 0, 0);

      if (startDate < now) {
        return res
          .status(400)
          .json({ message: "Нельзя добавлять активности задним числом" });
      }

      if (body.startDate && body.endDate && body.startDate >= body.endDate) {
        return res.status(400).json({
          message: "Дата окончания должна быть позже даты начала",
        });
      }

      const activityData = insertActivitySchema.parse(body);
      const activity = await storage.createActivity(activityData);
      res.status(201).json(activity);
    } catch (error) {
      console.error("POST /api/activities error", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid activity data",
          errors: error.errors,
        });
      }

      if (
        (error as Error).message ===
        "Дата окончания должна быть позже даты начала"
      ) {
        return res.status(400).json({
          message: (error as Error).message,
        });
      }

      if (
        (error as Error).message ===
        "Пересечение по времени. Повторите планирование"
      ) {
        return res.status(400).json({
          message: (error as Error).message,
        });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/activities/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const raw = req.body as any;

      const dataToValidate = {
        ...raw,
        startDate: raw.startDate ? new Date(raw.startDate) : undefined,
        endDate: raw.endDate ? new Date(raw.endDate) : undefined,
      };

      if (
        dataToValidate.startDate &&
        dataToValidate.endDate &&
        dataToValidate.startDate >= dataToValidate.endDate
      ) {
        return res.status(400).json({
          message: "Дата окончания должна быть позже даты начала",
        });
      }

      const data = updateActivitySchema.parse(dataToValidate);

      const activity = await storage.updateActivity(id, data);
      res.json(activity);
    } catch (error) {
      console.error("PATCH /api/activities error", error);

      if (
        (error as Error).message ===
        "Дата окончания должна быть позже даты начала"
      ) {
        return res.status(400).json({
          message: (error as Error).message,
        });
      }

      if (
        (error as Error).message ===
        "Пересечение по времени. Повторите планирование"
      ) {
        return res.status(400).json({
          message: (error as Error).message,
        });
      }

      return res.status(400).json({
        message: "Invalid activity data",
        errors: (error as any).issues ?? [],
      });
    }
  });

  app.get("/api/activities/calendar/user/:userId", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate
        ? new Date(startDate as string)
        : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      if (!start || !end) {
        return res
          .status(400)
          .json({
            message: "startDate и endDate обязательны для календаря",
          });
      }

      const stats = await storage.getActivityCalendarStatsByUser(
        req.params.userId,
        start,
        end,
      );

      res.json({ items: stats });
    } catch (error) {
      console.error("[API] /api/activities/calendar/user error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

// Messages
app.get("/api/messages/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    console.log("GET /api/messages for user:", userId);

    const messages = await storage.getMessages(userId);
    console.log("MESSAGES API RESULT:", messages);

    const formatted = messages.map((message) => ({
      ...message,
      createdAt: message.createdAt
        ? format(message.createdAt, "'отправлено' dd.MMM.yyyy 'в' HH:mm", { locale: ru })
        : null,
    }));

    console.log("MESSAGES API FORMATTED:", formatted);

    res.json(formatted);
  } catch (error) {
    console.error("GET /api/messages/:userId error", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// НОВОЕ: маршрут для создания сообщений
app.post("/api/messages", async (req, res) => {
  try {
    console.log("POST /api/messages body:", req.body);

    const messageData = insertMessageSchema.parse(req.body);
    console.log("POST /api/messages parsed:", messageData);

    const message = await storage.createMessage(messageData);
    console.log("POST /api/messages storage result:", message);

    const formatted = {
  ...message,
  createdAt: message.createdAt
    ? format(
        message.createdAt,
        "'отправлено' dd.MM.yyyy 'в' HH:mm",
        { locale: ru },
      )
    : null,
};

    res.status(201).json(formatted);
  } catch (error) {
    console.error("POST /api/messages error", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid message data",
        errors: error.errors,
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

app.patch("/api/messages/:messageId/read", async (req, res) => {
  try {
    const messageId = req.params.messageId;
    await storage.markMessageAsRead(messageId);
    res.status(204).send();
  } catch (error) {
    console.error("PATCH /api/messages/:messageId/read error", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.patch("/api/activities/:id/status", async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body as { status: string };

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    console.log("UPDATE STATUS REQUEST", { id, status });

    const existing = await storage.getActivity(id);

    if (!existing) {
      return res.status(404).json({ message: "Activity not found" });
    }

    if (status === "completed") {
      const now = new Date();
      const endDateTime = new Date(existing.endDate);

      if (now.getTime() < endDateTime.getTime()) {
        return res.status(400).json({
          message: "Нельзя завершить активность раньше времени окончания",
        });
      }
    }

    const activity = await storage.updateActivityStatus(id, status);

    console.log("UPDATE STATUS SUCCESS", activity);

    res.json(activity);
  } catch (error) {
    console.error("PATCH /api/activities/:id/status error", error);
    res.status(500).json({
      message: "Internal server error when updating status",
      error: (error as any)?.message ?? String(error),
    });
  }
});

// вот этот кусок необходим:
const httpServer = createServer(app);
return httpServer;
}