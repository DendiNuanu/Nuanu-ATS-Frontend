import { fetchEmployees } from "@/lib/data-access";
import { EmployeesClient } from "./EmployeesClient";

export default async function EmployeesPage() {
  const employees = await fetchEmployees();

  return <EmployeesClient initialEmployees={employees} />;
}
