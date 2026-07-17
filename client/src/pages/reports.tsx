import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi, employeeApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { ActivityWithDetails } from "@shared/schema";

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export default function Reports() {
  const { user } = useAuth();
  const [currentDate] = useState(() => new Date());

  if (user?.role !== "admin" && user?.role !== "director") {
    return (
      <div className="p-4 pb-20">
        <p>Доступ к отчётам есть только у администратора и директора.</p>
      </div>
    );
  }

  const { data: allActivities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/activities/all"],
    queryFn: () => activityApi.getAllActivities(),
  });

  const { data: allEmployees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees/all"],
    queryFn: () => employeeApi.getAllEmployees(),
  });

  const { start, end } = getMonthRange(currentDate);

  const activitiesThisMonth: ActivityWithDetails[] = allActivities.filter((activity) => {
    const startDate = new Date(activity.startDate);
    return startDate >= start && startDate <= end;
  });

  type ManagerStat = {
    managerName: string;
    count: number;
    cities: Set<string>;
    employees: Set<string>;
  };

  const managersStats = activitiesThisMonth.reduce<Record<string, ManagerStat>>(
    (acc, activity) => {
      const managerName = activity.managerName || "Не указан";
      if (!acc[managerName]) {
        acc[managerName] = {
          managerName,
          count: 0,
          cities: new Set<string>(),
          employees: new Set<string>(),
        };
      }
      acc[managerName].count += 1;
      if (activity.city?.name) acc[managerName].cities.add(activity.city.name);
      if (activity.employeeId) acc[managerName].employees.add(activity.employeeId);
      return acc;
    },
    {},
  );

  const statsArray = Object.values(managersStats);

  return (
    <div className="p-4 pb-20">
      <h1 className="text-lg font-semibold mb-4">Отчёты</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Активность менеджеров за месяц</CardTitle>
        </CardHeader>
        <CardContent>
          {activitiesLoading || employeesLoading ? (
            <div className="text-center py-4">Загрузка данных...</div>
          ) : statsArray.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              За выбранный месяц нет активностей.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2">Менеджер</th>
                    <th className="text-left py-2 pr-2">Активностей</th>
                    <th className="text-left py-2 pr-2">Городов</th>
                    <th className="text-left py-2 pr-2">МП</th>
                  </tr>
                </thead>
                <tbody>
                  {statsArray.map((stat) => (
                    <tr key={stat.managerName} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">{stat.managerName}</td>
                      <td className="py-2 pr-2">{stat.count}</td>
                      <td className="py-2 pr-2">
                        {Array.from(stat.cities).join(", ") || "—"}
                      </td>
                      <td className="py-2 pr-2">
                        {Array.from(stat.employees).length || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}