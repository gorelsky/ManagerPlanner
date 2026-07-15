import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* === Таблицы === */

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  middleName: text("middle_name"),
  profileImage: text("profile_image"),
  role: text("role").notNull().default("manager"), // manager, admin
  cityId: varchar("city_id").references(() => cities.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cities = pgTable("cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  region: text("region"),
});

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  middleName: text("middle_name"),
  managerId: varchar("manager_id").references(() => users.id),
  cityId: varchar("city_id").references(() => cities.id),
  profileImage: text("profile_image"),
  position: text("position").default("Медицинский представитель"),
  phone: text("phone"),
  email: text("email"),
});

export const activityTypes = pgTable("activity_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  requiresEmployee: boolean("requires_employee").default(false),
  visitEquivalent: numeric("visit_equivalent", {
    precision: 3,
    scale: 1,
  })
    .notNull()
    .default("1.0"),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  typeId: varchar("type_id").notNull().references(() => activityTypes.id),
  cityId: varchar("city_id").notNull().references(() => cities.id),
  employeeId: varchar("employee_id").references(() => employees.id),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status")
    .notNull()
    .default("planned"), // planned, in_progress, completed, cancelled, rescheduled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  receiverId: varchar("receiver_id").references(() => users.id), // null для общего чата
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const holidays = pgTable("holidays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  name: text("name").notNull(),
});

// новая таблица: города, закреплённые за менеджером
export const managerCities = pgTable("manager_cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  managerId: varchar("manager_id").notNull().references(() => users.id),
  cityId: varchar("city_id").notNull().references(() => cities.id),
});

/* === Relations === */

export const usersRelations = relations(users, ({ many, one }) => ({
  activities: many(activities),
  employees: many(employees),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
  city: one(cities, {
    fields: [users.cityId],
    references: [cities.id],
  }),
  managerCities: many(managerCities),
}));

export const citiesRelations = relations(cities, ({ many }) => ({
  activities: many(activities),
  employees: many(employees),
  managerCities: many(managerCities),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  manager: one(users, {
    fields: [employees.managerId],
    references: [users.id],
  }),
  city: one(cities, {
    fields: [employees.cityId],
    references: [cities.id],
  }),
  activities: many(activities),
}));

export const activityTypesRelations = relations(activityTypes, ({ many }) => ({
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  type: one(activityTypes, {
    fields: [activities.typeId],
    references: [activityTypes.id],
  }),
  city: one(cities, {
    fields: [activities.cityId],
    references: [cities.id],
  }),
  employee: one(employees, {
    fields: [activities.employeeId],
    references: [employees.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
  }),
}));

export const managerCitiesRelations = relations(managerCities, ({ one }) => ({
  manager: one(users, {
    fields: [managerCities.managerId],
    references: [users.id],
  }),
  city: one(cities, {
    fields: [managerCities.cityId],
    references: [cities.id],
  }),
}));

// для holidays у тебя сейчас нет реальных связей — можно оставить пустую декларацию
export const holidaysRelations = relations(holidays, () => ({}));

/* === Insert schemas === */

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCitySchema = createInsertSchema(cities).omit({
  id: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
});

export const insertActivityTypeSchema = createInsertSchema(activityTypes).omit({
  id: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({
  id: true,
});

// 🔽 СХЕМА ДЛЯ PATCH / ОБНОВЛЕНИЯ
export const updateActivitySchema = insertActivitySchema.partial();

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertManagerCitySchema = createInsertSchema(managerCities).omit({
  id: true,
});

/* === Types === */

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type City = typeof cities.$inferSelect;
export type InsertCity = z.infer<typeof insertCitySchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type ActivityType = typeof activityTypes.$inferSelect;
export type InsertActivityType = z.infer<typeof insertActivityTypeSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

// 🔽 ТИП ДЛЯ ОБНОВЛЕНИЯ
export type UpdateActivity = z.infer<typeof updateActivitySchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type ManagerCity = typeof managerCities.$inferSelect;
export type InsertManagerCity = z.infer<typeof insertManagerCitySchema>;

export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;

/* === Extended types with relations === */

export type ActivityWithDetails = Activity & {
  type: ActivityType;
  city: City;
  employee?: Employee;
  managerName?: string;
};

export type EmployeeWithDetails = Employee & {
  manager?: User;
  city?: City;
};

export type MessageWithDetails = Message & {
  sender: User;
  receiver?: User;
};