import { 
  users, cities, employees, activityTypes, activities, messages,
  type User, type InsertUser,
  type City, type InsertCity,
  type Employee, type InsertEmployee, type EmployeeWithDetails,
  type ActivityType, type InsertActivityType,
  type Activity, type InsertActivity, type ActivityWithDetails,
  type Message, type InsertMessage, type MessageWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, asc, or, isNull } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getManagersList(): Promise<User[]>;

  // Cities
  getCities(): Promise<City[]>;
  createCity(city: InsertCity): Promise<City>;

  // Employees
  getEmployeesByManager(managerId: string): Promise<EmployeeWithDetails[]>;
  getAllEmployees(): Promise<EmployeeWithDetails[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  importEmployees(csvData: string): Promise<{ imported: number }>;

  // Activity Types
  getActivityTypes(): Promise<ActivityType[]>;
  createActivityType(activityType: InsertActivityType): Promise<ActivityType>;
  initializeActivityTypes(): Promise<void>;
  initializeUsers(): Promise<void>;
  initializeCities(): Promise<void>;

  // Activities
  getActivitiesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<ActivityWithDetails[]>;
  getAllActivities(startDate?: Date, endDate?: Date): Promise<ActivityWithDetails[]>;
  getActivity(id: string): Promise<ActivityWithDetails | undefined>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, activity: Partial<InsertActivity>): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;
  updateActivityStatus(id: string, status: string): Promise<Activity>;

  // Messages
  getMessages(userId: string): Promise<MessageWithDetails[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(messageId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getCities(): Promise<City[]> {
    return await db.select().from(cities).orderBy(asc(cities.name));
  }

  async createCity(insertCity: InsertCity): Promise<City> {
    const [city] = await db
      .insert(cities)
      .values(insertCity)
      .returning();
    return city;
  }

  async getManagersList(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "manager")).orderBy(asc(users.lastName));
  }

  async getEmployeesByManager(managerId: string): Promise<EmployeeWithDetails[]> {
    const result = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        middleName: employees.middleName,
        managerId: employees.managerId,
        cityId: employees.cityId,
        profileImage: employees.profileImage,
        position: employees.position,
        phone: employees.phone,
        email: employees.email,
        manager: users,
        city: cities,
      })
      .from(employees)
      .leftJoin(users, eq(employees.managerId, users.id))
      .leftJoin(cities, eq(employees.cityId, cities.id))
      .where(eq(employees.managerId, managerId))
      .orderBy(asc(employees.lastName));
    
    return result.map(row => ({
      ...row,
      manager: row.manager || undefined,
      city: row.city || undefined,
    }));
  }

  async getAllEmployees(): Promise<EmployeeWithDetails[]> {
    const result = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        middleName: employees.middleName,
        managerId: employees.managerId,
        cityId: employees.cityId,
        profileImage: employees.profileImage,
        position: employees.position,
        phone: employees.phone,
        email: employees.email,
        manager: users,
        city: cities,
      })
      .from(employees)
      .leftJoin(users, eq(employees.managerId, users.id))
      .leftJoin(cities, eq(employees.cityId, cities.id))
      .orderBy(asc(employees.lastName));
    
    return result.map(row => ({
      ...row,
      manager: row.manager || undefined,
      city: row.city || undefined,
    }));
  }

  async importEmployees(csvData: string): Promise<{ imported: number }> {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    let imported = 0;

    // Получить все города и менеджеров для поиска по именам
    const allCities = await this.getCities();
    const allManagers = await this.getManagersList();

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) continue;

      const employeeData: Record<string, string> = {};
      headers.forEach((header, index) => {
        employeeData[header] = values[index];
      });

      // Найти ID города и менеджера
      const city = allCities.find(c => c.name === employeeData.city);
      const manager = allManagers.find(m => m.username === employeeData.manager);

      if (!city || !manager) continue;

      try {
        await this.createEmployee({
          firstName: employeeData.firstName,
          lastName: employeeData.lastName,
          middleName: employeeData.middleName || undefined,
          managerId: manager.id,
          cityId: city.id,
          profileImage: employeeData.profileImage || undefined,
          position: employeeData.position || "Медицинский представитель",
          phone: employeeData.phone || undefined,
          email: employeeData.email || undefined,
        });
        imported++;
      } catch (error) {
        console.error('Error importing employee:', error);
      }
    }

    return { imported };
  }
async importUsersFromCsv(csvData: string, role: "manager" | "admin" = "manager"): Promise<{ imported: number }> {
  const lines = csvData.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  let imported = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length !== headers.length) continue;

    const userData: Record<string, string> = {};
    headers.forEach((header, index) => {
      userData[header] = values[index];
    });

    // ожидаем в CSV столбцы: username, password, firstName, lastName, middleName, profileImage
    if (!userData.username || !userData.password || !userData.firstName || !userData.lastName) {
      continue;
    }

    try {
      await this.createUser({
        username: userData.username,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        middleName: userData.middleName || undefined,
        profileImage: userData.profileImage || undefined,
        role, // по умолчанию "manager", можно передать "admin"
      });
      imported++;
    } catch (error) {
      console.error("Error importing user:", error);
    }
  }

  return { imported };
}
  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const [employee] = await db
      .insert(employees)
      .values(insertEmployee)
      .returning();
    return employee;
  }

  async getActivityTypes(): Promise<ActivityType[]> {
    return await db.select().from(activityTypes).orderBy(asc(activityTypes.name));
  }

  async createActivityType(insertActivityType: InsertActivityType): Promise<ActivityType> {
    const [activityType] = await db
      .insert(activityTypes)
      .values(insertActivityType)
      .returning();
    return activityType;
  }

async initializeUsers(): Promise<void> {
  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    await db.insert(users).values([
      {
        username: "admin",
        password: "admin123",
        firstName: "Администратор",
        lastName: "Системы",
        role: "admin",
      },
    ]);
    console.log("Users initialized");
  }
}

  async initializeCities(): Promise<void> {
    const existingCities = await db.select().from(cities);
    if (existingCities.length === 0) {
      await db.insert(cities).values([
        { name: "Москва" },
        { name: "Санкт-Петербург" },
        { name: "Новосибирск" },
        { name: "Екатеринбург" },
        { name: "Казань" },
      ]);
      console.log("Cities initialized");
    }
  }

  async initializeActivityTypes(): Promise<void> {
    const existingTypes = await this.getActivityTypes();
    
    // Список всех типов активностей с ВЭ значениями
    const defaultActivityTypes = [
      { name: "Административная работа (проверка фин отчетов, собственная фин отчетность, работа с аналитикой и т.д.)", visitEquivalent: "2.0", requiresEmployee: false },
      { name: "Аудит визит", visitEquivalent: "1.5", requiresEmployee: true },
      { name: "Больничный", visitEquivalent: "14.0", requiresEmployee: false },
      { name: "Визит в офис АС", visitEquivalent: "3.0", requiresEmployee: false },
      { name: "Визит к дистрибьютору", visitEquivalent: "2.0", requiresEmployee: false },
      { name: "Визит к OPL", visitEquivalent: "2.0", requiresEmployee: false },
      { name: "Внеплановое обслуживание корп. авто (заправка, шиномонтаж)", visitEquivalent: "1.0", requiresEmployee: false },
      { name: "Возвращение домой из служебной поездки", visitEquivalent: "6.0", requiresEmployee: false },
      { name: "Групповая презентация (лекция)", visitEquivalent: "4.0", requiresEmployee: false },
      { name: "Двойной Визит", visitEquivalent: "1.5", requiresEmployee: true },
      { name: "Индивидуальные визиты ТМ", visitEquivalent: "1.0", requiresEmployee: true },
      { name: "Командировка (однодневная)", visitEquivalent: "4.0", requiresEmployee: false },
      { name: "Конференция", visitEquivalent: "14.0", requiresEmployee: false },
      { name: "Круглый стол", visitEquivalent: "10.0", requiresEmployee: false },
      { name: "Отгул", visitEquivalent: "14.0", requiresEmployee: false },
      { name: "Отпуск", visitEquivalent: "14.0", requiresEmployee: false },
      { name: "Переезд в место служебной поездки", visitEquivalent: "6.0", requiresEmployee: false },
      { name: "Плановое обслуживание корп. авто (прохождение ТО)", visitEquivalent: "7.0", requiresEmployee: false },
      { name: "Получение грузов (POSM, образцы и т.д)", visitEquivalent: "2.0", requiresEmployee: false },
      { name: "Работа в офисе (для Менеджеров)", visitEquivalent: "14.0", requiresEmployee: false },
      { name: "Работа в CRM", visitEquivalent: "2.0", requiresEmployee: false },
      { name: "Собеседование", visitEquivalent: "2.0", requiresEmployee: false },
      { name: "Собрание", visitEquivalent: "4.0", requiresEmployee: false },
      { name: "Тестирование", visitEquivalent: "4.0", requiresEmployee: false },
      { name: "Тренинг", visitEquivalent: "14.0", requiresEmployee: false },
      { name: "Участие в цикловой конференции", visitEquivalent: "14.0", requiresEmployee: false },
      { name: "Фармкружок", visitEquivalent: "2.0", requiresEmployee: false },
      { name: "ФУВ", visitEquivalent: "4.0", requiresEmployee: false },
    ];

    // Создаем только те типы, которых еще нет
    for (const activityType of defaultActivityTypes) {
      const exists = existingTypes.find(existing => existing.name === activityType.name);
      if (!exists) {
        try {
          await this.createActivityType(activityType);
        } catch (error) {
          console.error(`Error creating activity type "${activityType.name}":`, error);
        }
      }
    }

    console.log(`Activity types initialized. Total: ${defaultActivityTypes.length}`);
  }

  async getActivitiesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<ActivityWithDetails[]> {
    const conditions: any[] = [eq(activities.userId, userId)];
    if (startDate) conditions.push(gte(activities.startDate, startDate));
    if (endDate) conditions.push(lte(activities.endDate, endDate));
    return this.queryActivities(conditions);
  }

  async getAllActivities(startDate?: Date, endDate?: Date): Promise<ActivityWithDetails[]> {
    const conditions: any[] = [];
    if (startDate) conditions.push(gte(activities.startDate, startDate));
    if (endDate) conditions.push(lte(activities.endDate, endDate));
    return this.queryActivities(conditions);
  }

  private async queryActivities(conditions: any[]): Promise<ActivityWithDetails[]> {
    const result = await db
      .select({
        id: activities.id,
        userId: activities.userId,
        typeId: activities.typeId,
        cityId: activities.cityId,
        employeeId: activities.employeeId,
        title: activities.title,
        description: activities.description,
        startDate: activities.startDate,
        endDate: activities.endDate,
        status: activities.status,
        createdAt: activities.createdAt,
        updatedAt: activities.updatedAt,
        type: activityTypes,
        city: cities,
        employee: employees,
        managerFirstName: users.firstName,
        managerLastName: users.lastName,
        managerUsername: users.username,
      })
      .from(activities)
      .leftJoin(activityTypes, eq(activities.typeId, activityTypes.id))
      .leftJoin(cities, eq(activities.cityId, cities.id))
      .leftJoin(employees, eq(activities.employeeId, employees.id))
      .leftJoin(users, eq(activities.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(activities.startDate));

    return result.map(row => ({
      ...row,
      type: row.type!,
      city: row.city!,
      employee: row.employee || undefined,
      managerName: `${row.managerFirstName || ''} ${row.managerLastName || ''}`.trim() || row.managerUsername || '',
    }));
  }

  async getActivity(id: string): Promise<ActivityWithDetails | undefined> {
    const [result] = await db
      .select({
        id: activities.id,
        userId: activities.userId,
        typeId: activities.typeId,
        cityId: activities.cityId,
        employeeId: activities.employeeId,
        title: activities.title,
        description: activities.description,
        startDate: activities.startDate,
        endDate: activities.endDate,
        status: activities.status,
        createdAt: activities.createdAt,
        updatedAt: activities.updatedAt,
        type: activityTypes,
        city: cities,
        employee: employees,
      })
      .from(activities)
      .leftJoin(activityTypes, eq(activities.typeId, activityTypes.id))
      .leftJoin(cities, eq(activities.cityId, cities.id))
      .leftJoin(employees, eq(activities.employeeId, employees.id))
      .where(eq(activities.id, id));

    if (!result) return undefined;

    return {
      ...result,
      type: result.type!,
      city: result.city!,
      employee: result.employee || undefined,
    };
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db
      .insert(activities)
      .values({
        ...insertActivity,
        updatedAt: new Date(),
      })
      .returning();
    return activity;
  }

  async updateActivity(id: string, updateActivity: Partial<InsertActivity>): Promise<Activity> {
    const [activity] = await db
      .update(activities)
      .set({
        ...updateActivity,
        updatedAt: new Date(),
      })
      .where(eq(activities.id, id))
      .returning();
    return activity;
  }

 async deleteActivity(id: string): Promise<void> {
  await db.delete(activities).where(eq(activities.id, id));
}

async deleteUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

async updateActivityStatus(id: string, status: string): Promise<Activity> {
  const [activity] = await db
    .update(activities)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(activities.id, id))
    .returning();
  return activity;
}

  async getMessages(userId: string): Promise<MessageWithDetails[]> {
    const result = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        receiverId: messages.receiverId,
        content: messages.content,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        sender: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          middleName: users.middleName,
          profileImage: users.profileImage,
          role: users.role,
          password: users.password,
          createdAt: users.createdAt,
        },
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(
        or(
          // Сообщения где пользователь является отправителем
          eq(messages.senderId, userId),
          // Сообщения где пользователь является получателем
          eq(messages.receiverId, userId),
          // Общие сообщения (receiverId = null)
          isNull(messages.receiverId)
        )
      )
      .orderBy(desc(messages.createdAt));

    // Получаем информацию о получателях для сообщений
    const messagesWithDetails: MessageWithDetails[] = [];
    
    for (const row of result) {
      let receiver: any = undefined;
      
      if (row.receiverId) {
        const [receiverData] = await db
          .select()
          .from(users)
          .where(eq(users.id, row.receiverId));
        receiver = receiverData;
      }

      messagesWithDetails.push({
        id: row.id,
        senderId: row.senderId,
        receiverId: row.receiverId,
        content: row.content,
        isRead: row.isRead,
        createdAt: row.createdAt,
        sender: row.sender,
        receiver,
      });
    }

    return messagesWithDetails;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, messageId));
  }
}

export const storage = new DatabaseStorage();
