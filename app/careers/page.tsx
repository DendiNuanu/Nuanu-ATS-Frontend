import type { Metadata } from "next";
import { fetchPublicVacancies } from "@/lib/data-access";
import { formatIDR } from "@/lib/utils";
import { formatDateWita } from "@/lib/format-wita";
import { Briefcase, MapPin, Users, Building2, ArrowRight } from "lucide-react";

// Always render fresh vacancy data — never serve a stale cached list.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Careers — Nuanu",
  description: "Explore open positions at Nuanu and apply today.",
};

const employmentLabel: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
};

const locationLabel: Record<string, string> = {
  onsite: "On-site",
  remote: "Remote",
  hybrid: "Hybrid",
};

export default async function CareersPage() {
  const vacancies = await fetchPublicVacancies();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8rCDTckVq3MiavNsW646gIm0afBWgG79oHNgaD7Wsy26_G2qdhePaHw0&s=10"
              alt="Nuanu"
              className="h-9 w-9 rounded-lg object-cover"
            />
            <span className="font-heading text-lg font-bold text-slate-900">
              Nuanu
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative text-white"
        style={{
          backgroundImage:
            "url('https://www.nuanu.com/_next/image?url=%2Fnuanu-impact-2025.webp&w=3840&q=75')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#006b5f]/85 to-[#004a42]/85" />
        <div className="relative mx-auto max-w-5xl px-6 py-16 text-center">
          <h1 className="font-heading text-4xl font-bold mb-4">
            Join Our Team
          </h1>
          <p className="text-lg text-white/90 max-w-2xl mx-auto">
            We are looking for the best talent to build a better future together
          </p>
        </div>
      </section>

      {/* Job listings */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-2xl font-bold text-slate-900">
            Open Positions
          </h2>
          <span className="text-sm text-slate-500">
            {vacancies.length} {vacancies.length === 1 ? "role" : "roles"} available
          </span>
        </div>

        {vacancies.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              No open positions at the moment. Please check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {vacancies.map((job) => (
              <div
                key={job.id}
                className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-[#006b5f] hover:shadow-md"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="h-11 w-11 rounded-xl bg-[#e6f5f3] flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-5 w-5 text-[#006b5f]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-[#006b5f] transition-colors">
                      {job.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {job.departmentName}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mb-4">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    {employmentLabel[job.employmentType] ?? job.employmentType}
                  </span>
                  {job.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {job.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {locationLabel[job.locationType] ?? job.locationType}
                  </span>
                </div>

                {job.description && (
                  <p className="text-sm text-slate-600 line-clamp-3 mb-4">
                    {job.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div>
                    {job.salaryMin != null && job.salaryMax != null ? (
                      <p className="text-sm font-medium text-slate-700">
                        {formatIDR(job.salaryMin)} – {formatIDR(job.salaryMax)}
                      </p>
                    ) : job.salaryMin != null ? (
                      <p className="text-sm font-medium text-slate-700">
                        From {formatIDR(job.salaryMin)}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">
                        Salary negotiable
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      Posted{" "}
                      {formatDateWita(job.postedDate)}
                    </p>
                  </div>
                  <a
                    href={`/careers/${job.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#006b5f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#005248]"
                  >
                    View Details
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center">
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Nuanu. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
