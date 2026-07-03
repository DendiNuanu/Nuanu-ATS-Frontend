import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

/**
 * POST /api/auth/login
 *
 * Authenticates a user against the database.
 *
 * 1. Looks up the user by email (case-insensitive, not soft-deleted).
 * 2. Verifies the plaintext password against the stored hash using
 *    `verifyPassword()` (scrypt-based, with legacy plaintext fallback).
 * 3. Returns the user's display info (name, email, role) on success.
 *
 * This replaces the old frontend-only mock auth that only accepted the
 * hardcoded super-admin credentials.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Find user by email (case-insensitive, not soft-deleted)
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
        deletedAt: null,
      },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    // 2. Verify password
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is suspended. Please contact an administrator." },
        { status: 403 },
      );
    }

    const isValid = verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    // 3. Return user display info
    const role = user.userRoles[0]?.role?.name ?? "HR Staff";

    return NextResponse.json({
      ok: true,
      user: {
        name: user.name,
        email: user.email,
        role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 },
    );
  }
}
