import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, role, department } = body;

    // ── Validation ──────────────────────────────────────────────
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 },
      );
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }
    if (
      !password ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    if (!role || typeof role !== "string") {
      return NextResponse.json(
        { error: "Role is required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ── Check email uniqueness (case-insensitive) ──────────────
    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
        deletedAt: null,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    // ── Resolve role by name ────────────────────────────────────
    const roleRecord = await prisma.role.findFirst({
      where: { name: role },
    });
    if (!roleRecord) {
      return NextResponse.json(
        { error: `Role "${role}" not found` },
        { status: 400 },
      );
    }

    // ── Resolve department by name (optional) ──────────────────
    let departmentId: string | undefined;
    if (department && department !== "—") {
      const dept = await prisma.department.findFirst({
        where: { name: department },
      });
      if (dept) {
        departmentId = dept.id;
      }
    }

    // ── Hash password & create user ────────────────────────────
    const hashedPassword = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        departmentId,
        userRoles: {
          create: {
            roleId: roleRecord.id,
          },
        },
      },
    });

    return NextResponse.json(
      { success: true, id: user.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create user:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
