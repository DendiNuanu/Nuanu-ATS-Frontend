"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Button } from "@/components/ui";
import { ALL_ROLES, DEPARTMENTS, type UserRole } from "@/lib/mock-data";
import { ArrowLeft, UserPlus } from "lucide-react";

export default function CreateUserPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("HR Staff");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [created, setCreated] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Frontend-only: in a real app this would POST to an API.
    // Here we just show a success confirmation.
    setCreated(true);
    setTimeout(() => {
      setCreated(false);
      setFullName("");
      setEmail("");
      setRole("HR Staff");
      setDepartment(DEPARTMENTS[0]);
    }, 2500);
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20";

  return (
    <div>
      {/* Back link */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#006b5f] mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            Create User
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Add a new team member and assign their role and department.
          </p>
        </div>

        <Card>
          {created && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              User created successfully! They will appear in the Users & Roles list.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john.doe@nuanu.com"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className={inputClass}
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={inputClass}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <Link href="/settings">
                <Button variant="ghost" size="md">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                size="md"
                icon={<UserPlus className="h-4 w-4" />}
                type="submit"
              >
                Create User
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
