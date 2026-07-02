"use client";

import { useState } from "react";
import {
  PageHeader,
  Card,
  StatusPill,
  Button,
  Avatar,
  SearchInput,
  Tabs,
  EmptyState,
} from "@/components/ui";
import type { Employee } from "@/lib/mock-data";
import {
  Pencil,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  X,
} from "lucide-react";

const detailTabs = [
  { id: "profile", label: "Profile" },
  { id: "contract", label: "Contract" },
  { id: "compensation", label: "Compensation" },
  { id: "documents", label: "Documents" },
  { id: "assets", label: "Assets" },
  { id: "history", label: "History" },
];

export function EmployeesClient({
  initialEmployees,
}: {
  initialEmployees: Employee[];
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState("profile");

  const filtered = initialEmployees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage your organization's employee records."
      />

      <div className="mb-6">
        <SearchInput
          placeholder="Search employees..."
          value={search}
          onChange={setSearch}
          className="sm:max-w-md"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table */}
        <div className={selected ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                    <th className="text-left font-medium px-6 py-3">Employee</th>
                    <th className="text-left font-medium px-6 py-3">Position</th>
                    <th className="text-left font-medium px-6 py-3">Department</th>
                    <th className="text-left font-medium px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => {
                        setSelected(e);
                        setActiveTab("profile");
                      }}
                      className={`cursor-pointer transition-colors ${
                        selected?.id === e.id
                          ? "bg-[#e6f5f3]"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={e.name} size="md" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{e.name}</p>
                            <p className="text-xs text-slate-400">{e.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{e.position}</td>
                      <td className="px-6 py-4 text-slate-600">{e.department}</td>
                      <td className="px-6 py-4">
                        <StatusPill status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="lg:col-span-1">
            <Card noPadding className="overflow-hidden">
              {/* Panel header */}
              <div className="relative p-6 bg-gradient-to-br from-[#006b5f] to-[#014239] text-white">
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-4 right-4 h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
                <Avatar
                  name={selected.name}
                  size="xl"
                  className="!bg-white/20 mb-3"
                />
                <h3 className="text-lg font-bold font-heading">{selected.name}</h3>
                <p className="text-sm text-white/80">{selected.position}</p>
                <p className="text-xs text-white/60 mt-0.5">
                  {selected.department}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                    {selected.employeeId}
                  </span>
                  <StatusPill status={selected.status} />
                </div>
              </div>

              {/* Tabs */}
              <div className="px-2 border-b border-slate-200">
                <Tabs tabs={detailTabs} active={activeTab} onChange={setActiveTab} />
              </div>

              {/* Tab content */}
              <div className="p-6">
                {activeTab === "profile" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4">
                      <ContactField
                        icon={Mail}
                        label="Email"
                        value={selected.email}
                      />
                      <ContactField
                        icon={Phone}
                        label="Phone"
                        value={selected.phone}
                      />
                      <ContactField
                        icon={MapPin}
                        label="Location"
                        value={selected.location}
                      />
                      <ContactField
                        icon={Calendar}
                        label="Join Date"
                        value={new Date(selected.joinDate).toLocaleDateString(
                          "en-GB",
                          { day: "numeric", month: "long", year: "numeric" },
                        )}
                      />
                      <ContactField
                        icon={Briefcase}
                        label="Department"
                        value={selected.department}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      className="w-full"
                      icon={<Pencil className="h-4 w-4" />}
                      onClick={() => console.log("edit")}
                    >
                      Edit Profile
                    </Button>
                  </div>
                )}

                {activeTab !== "profile" && (
                  <EmptyState
                    icon={Briefcase}
                    title={
                      detailTabs.find((t) => t.id === activeTab)?.label ?? ""
                    }
                    description="This section will be populated in the full application."
                    className="py-8"
                  />
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-900 break-words">{value}</p>
      </div>
    </div>
  );
}
