import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@inventory.local" },
    update: {},
    create: {
      email: "admin@inventory.local",
      name: "Admin",
      hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("Seeded admin user:", admin.email);
  console.log("Default password: admin123");
  console.log("⚠️  Change this password immediately after first login!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
