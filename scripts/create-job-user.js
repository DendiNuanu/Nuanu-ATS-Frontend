/**
 * Creates the job@nuanu.com user with password "jobnuanu0361" and assigns
 * the Super Admin role. This restores the legacy mock-auth credential that
 * stopped working after switching to real DB-based authentication.
 *
 * Usage:
 *   node scripts/create-job-user.js
 *
 * Requires DATABASE_URL in the environment (.env.local).
 */
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

async function main() {
  const email = "job@nuanu.com";
  const password = "jobnuanu0361";
  const name = "Job Nuanu";

  // Find the Super Admin role
  const superAdminRole = await prisma.role.findFirst({
    where: { name: { equals: "Super Admin", mode: "insensitive" } },
  });

  if (!superAdminRole) {
    throw new Error(
      'Super Admin role not found. Please ensure the roles table is seeded.',
    );
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { userRoles: true },
  });

  if (existing) {
    // Update password and ensure role is assigned
    const hashed = hashPassword(password);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hashed,
        name,
        isActive: true,
        deletedAt: null,
      },
    });

    // Ensure Super Admin role is assigned
    const hasRole = existing.userRoles.some(
      (ur) => ur.roleId === superAdminRole.id,
    );
    if (!hasRole) {
      await prisma.userRole.create({
        data: {
          userId: existing.id,
          roleId: superAdminRole.id,
        },
      });
    }

    console.log(`✓ Updated existing user: ${email} (id: ${existing.id})`);
    return;
  }

  // Create new user
  const hashed = hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashed,
      isActive: true,
    },
  });

  // Assign Super Admin role
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: superAdminRole.id,
    },
  });

  console.log(`✓ Created user: ${email} (id: ${user.id}) with Super Admin role`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("✗ Failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
