import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  numeric,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Константа для статусов активности (используется в коде и валидации)
export const ACTIVITY_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
  "rescheduled",
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const APPROVAL_STATUSES = ["created", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

// Константа для ролей пользователей
export const USER_ROLES = ["admin", "manager", "director", "hr_director"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/* === Таблицы === */

export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    middleName: text("middle_name"),
    profileImage: text("profile_image"),
    role: text("role").$type<UserRole>().notNull().default("manager"),
    cityId: varchar("city_id").references(() => cities.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Индекс для поиска по роли (часто используется в запросах)
    roleIdx: index("users_role_idx").on(table.role),
    // Индекс для поиска по городу
    cityIdx: index("users_city_idx").on(table.cityId),
  }),
);

export const cities = pgTable(
  "cities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull().unique(),
    region: text("region"),
  },
  (table) => ({
    nameIdx: index("cities_name_idx").on(table.name),
  }),
);

export const employees = pgTable(
  "employees",
  {
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
  },
  (table) => ({
    managerIdx: index("employees_manager_idx").on(table.managerId),
    cityIdx: index("employees_city_idx").on(table.cityId),
  }),
);

export const activityTypes = pgTable(
  "activity_types",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull().unique(),
    requiresEmployee: boolean("requires_employee").default(false),
    visitEquivalent: numeric("visit_equivalent", {
      precision: 3,
      scale: 1,
    })
      .notNull()
      .default("1.0"),
  },
  (table) => ({
    nameIdx: index("activity_types_name_idx").on(table.name),
  }),
);

export const activities = pgTable(
  "activities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    typeId: varchar("type_id").notNull().references(() => activityTypes.id),
    cityId: varchar("city_id").notNull().references(() => cities.id),
    employeeId: varchar("employee_id").references(() => employees.id),
    title: text("title").notNull(),
    description: text("description"),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    status: text("status").$type<ActivityStatus>()
      .notNull()
      .default("planned"),
    approvalStatus: text("approval_status").$type<ApprovalStatus>()
      .notNull()
      .default("created"),
    reviewedBy: varchar("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("activities_user_idx").on(table.userId),
    typeIdx: index("activities_type_idx").on(table.typeId),
    cityIdx: index("activities_city_idx").on(table.cityId),
    employeeIdx: index("activities_employee_idx").on(table.employeeId),
    startDateIdx: index("activities_start_date_idx").on(table.startDate),
    endDateIdx: index("activities_end_date_idx").on(table.endDate),
    statusIdx: index("activities_status_idx").on(table.status),
    approvalStatusIdx: index("activities_approval_status_idx").on(
      table.approvalStatus,
    ),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    senderId: varchar("sender_id").notNull().references(() => users.id),
    receiverId: varchar("receiver_id").references(() => users.id),
    content: text("content").notNull(),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    senderIdx: index("messages_sender_idx").on(table.senderId),
    receiverIdx: index("messages_receiver_idx").on(table.receiverId),
    createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
  }),
);

export const holidays = pgTable(
  "holidays",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    date: timestamp("date").notNull(),
    name: text("name").notNull(),
  },
  (table) => ({
    dateIdx: index("holidays_date_idx").on(table.date),
  }),
);

export const managerCities = pgTable(
  "manager_cities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    managerId: varchar("manager_id").notNull().references(() => users.id),
    cityId: varchar("city_id").notNull().references(() => cities.id),
  },
  (table) => ({
    managerIdx: index("manager_cities_manager_idx").on(table.managerId),
    cityIdx: index("manager_cities_city_idx").on(table.cityId),
    // Уникальная пара (managerId, cityId) – чтобы не было дубликатов
    uniquePair: unique("manager_cities_unique_pair").on(
      table.managerId,
      table.cityId,
    ),
  }),
);

/* === Relations === */

export const usersRelations = relations(users, ({ many, one }) => ({
  activities: many(activities, { relationName: "activityOwner" }),
  reviewedActivities: many(activities, { relationName: "activityReviewer" }),
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
    relationName: "activityOwner",
  }),
  reviewer: one(users, {
    fields: [activities.reviewedBy],
    references: [users.id],
    relationName: "activityReviewer",
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

export const holidaysRelations = relations(holidays, () => ({}));

/* === Insert schemas === */

export const insertUserSchema = createInsertSchema(users, {
  role: z.enum(USER_ROLES),
})
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
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

export const insertActivitySchema = createInsertSchema(activities, {
  status: z.enum(ACTIVITY_STATUSES).default("planned"),
})
  .omit({
    id: true,
    approvalStatus: true,
    reviewedBy: true,
    reviewedAt: true,
    completedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .refine(
    (data) => data.startDate < data.endDate,
    {
      message: "Дата окончания должна быть позже даты начала",
      path: ["endDate"],
    },
  );

export const insertHolidaySchema = createInsertSchema(holidays).omit({
  id: true,
});

export const updateActivitySchema = z.object({
  userId: z.string().optional(),
  typeId: z.string().optional(),
  cityId: z.string().optional(),
  employeeId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: z.enum(["planned", "in_progress", "completed", "cancelled", "rescheduled"]).optional(),
});

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
export type PublicUser = Omit<User, "password">;

export type City = typeof cities.$inferSelect;
export type InsertCity = z.infer<typeof insertCitySchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type ActivityType = typeof activityTypes.$inferSelect;
export type InsertActivityType = z.infer<typeof insertActivityTypeSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

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
  sender: PublicUser;
  receiver?: PublicUser;
};
