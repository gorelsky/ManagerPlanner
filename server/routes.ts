import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertCitySchema, 
  insertEmployeeSchema, 
  insertActivityTypeSchema, 
  insertActivitySchema,
  insertMessageSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database with seed data
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

      // В реальном приложении здесь должна быть проверка хешированного пароля
      if (user.password !== password) {
        return res.status(401).json({ message: "Неверный логин или пароль" });
      }

      // Не возвращаем пароль в ответе
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
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
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
        return res.status(400).json({ message: "Invalid city data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // NEW: import cities from CSV
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
      res.status(500).json({ message: "Internal server error during cities import" });
    }
  });

  // НОВОЕ: города зоны менеджера
  app.get("/api/cities/manager/:managerId", async (req, res) => {
    try {
      const cities = await storage.getCitiesByManager(req.params.managerId);
      res.json(cities);
    } catch (error) {
      console.error("Error fetching manager cities:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // НОВОЕ: импорт зон менеджеров из CSV (managerEmail,city)
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
      res.status(500).json({ message: "Internal server error during manager cities import" });
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
      const employees = await storage.getEmployeesByManager(req.params.managerId);
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

  // Import managers (users) from CSV
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
      res.status(500).json({ message: "Internal server error during users import" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const employeeData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(employeeData);
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
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
      const activityType = await storage.createActivityType(activityTypeData);
      res.status(201).json(activityType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity type data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Activities
  app.get("/api/activities/all", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
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
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const activities = await storage.getActivitiesByUser(req.params.userId, start, end);
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
        return res.status(400).json({ message: "Нельзя добавлять активности задним числом" });
      }
      
      const activityData = insertActivitySchema.parse(body);
      const activity = await storage.createActivity(activityData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/activities/:id", async (req, res) => {
    try {
      const updateData = insertActivitySchema.partial().parse(req.body);
      const activity = await storage.updateActivity(req.params.id, updateData);
      res.json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/activities/:id/status", async (req, res) => {
    try {
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const activity = await storage.updateActivityStatus(req.params.id, status);
      res.json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Messages
  app.get("/api/messages/:userId", async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/messages/:id/read", async (req, res) => {
    try {
      await storage.markMessageAsRead(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}