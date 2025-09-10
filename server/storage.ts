import { 
  users, cities, employees, activityTypes, activities,
  type User, type InsertUser,
  type City, type InsertCity,
  type Employee, type InsertEmployee,
  type ActivityType, type InsertActivityType,
  type Activity, type InsertActivity,
  type ActivityWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Cities
  getCities(): Promise<City[]>;
  createCity(city: InsertCity): Promise<City>;

  // Employees
  getEmployeesByManager(managerId: string): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;

  // Activity Types
  getActivityTypes(): Promise<ActivityType[]>;
  createActivityType(activityType: InsertActivityType): Promise<ActivityType>;

  // Activities
  getActivitiesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<ActivityWithDetails[]>;
  getActivity(id: string): Promise<ActivityWithDetails | undefined>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, activity: Partial<InsertActivity>): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;
  updateActivityStatus(id: string, status: string): Promise<Activity>;
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

  async getEmployeesByManager(managerId: string): Promise<Employee[]> {
    return await db.select().from(employees).where(eq(employees.managerId, managerId));
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

  async getActivitiesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<ActivityWithDetails[]> {
    const conditions = [eq(activities.userId, userId)];
    if (startDate) {
      conditions.push(gte(activities.startDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(activities.endDate, endDate));
    }

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
      })
      .from(activities)
      .leftJoin(activityTypes, eq(activities.typeId, activityTypes.id))
      .leftJoin(cities, eq(activities.cityId, cities.id))
      .leftJoin(employees, eq(activities.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(asc(activities.startDate));
    
    return result.map(row => ({
      ...row,
      type: row.type!,
      city: row.city!,
      employee: row.employee || undefined,
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
}

export const storage = new DatabaseStorage();
