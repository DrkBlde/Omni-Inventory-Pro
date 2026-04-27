const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function rescue() {
  console.log("Starting Admin Rescue (Field Fix)...");
  
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // 1. Ensure Admin Role exists
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { 
      name: 'admin', 
      permissions: '*' 
    }
  });

  // 2. Ensure Admin User exists with the CORRECT field name (passwordHash)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { 
      passwordHash: hashedPassword, // Fixed field name
      roleId: adminRole.id 
    },
    create: { 
      username: 'admin', 
      passwordHash: hashedPassword, // Fixed field name
      roleId: adminRole.id,
      fullName: 'System Admin'
    }
  });

  console.log("✅ Admin rescued! Login with: admin / admin123");
  await prisma.$disconnect();
}

rescue().catch(err => {
  console.error("Rescue failed:", err);
  process.exit(1);
});