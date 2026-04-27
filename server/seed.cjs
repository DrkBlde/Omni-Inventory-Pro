const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const password = 'admin123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  console.log("Seeding database...");

  // 1. First, upsert the Admin Role so it has an ID we can link to
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {
      // Force update the permissions in case they got wiped
      permissions: JSON.stringify([
        "dashboard.view",
        "dashboard.customize",
        "inventory.view",
        "inventory.add",
        "inventory.edit",
        "inventory.delete",
        "inventory.manage",
        "pos.access",
        "roles.view",
        "roles.manage",
        "roles.create",
        "roles.delete",
        "can_create_bill",
        "attendance.view",
        "attendance.manage",
        "settings.manage",
        "users.view",
        "users.manage"
      ])
    },
    create: {
      name: 'Admin',
      permissions: JSON.stringify([
        "dashboard.view", "dashboard.customize", "inventory.view", "inventory.manage", "inventory.add", "inventory.edit", "inventory.delete",
        "pos.access", "roles.view", "roles.manage", "roles.create",
        "roles.delete", "can_create_bill", "attendance.view",
        "attendance.manage", "settings.manage", "users.view", "users.manage"
      ]),
    },
  });

  // Ensure the admin user is connected to this role
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { roleId: adminRole.id },
    create: {
      id: 'admin-001',
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      fullName: 'System Administrator',
      isActive: true,
      isSystem: true,
      roleRelation: { connect: { id: adminRole.id } }
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });      