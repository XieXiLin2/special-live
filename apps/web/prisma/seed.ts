import "dotenv/config";
import { PrismaClient } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.siteConfig.findFirst();

  if (existing) {
    console.log("SiteConfig already exists, skipping seed.");
    return;
  }

  await prisma.siteConfig.create({
    data: {
      siteTitle: "Live Stream",
      faviconUrl: "/favicon.ico",
    },
  });

  console.log("Seeded default SiteConfig: { siteTitle: 'Live Stream', faviconUrl: '/favicon.ico' }");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
