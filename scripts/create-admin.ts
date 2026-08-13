import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  const [, , name, email, password] = process.argv
  if (!name || !email || !password) {
    console.error('Usage: npm run admin:create -- "Admin Name" admin@example.com "StrongPassword"')
    process.exit(1)
  }
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.")
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await db.user.upsert({
    where: { email },
    create: { name, email, password: passwordHash, role: "admin", status: "active" },
    update: { name, password: passwordHash, role: "admin", status: "active", tokenVersion: { increment: 1 } },
    select: { id: true, name: true, email: true, role: true, status: true },
  })

  console.log(`Admin ready: ${user.email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
