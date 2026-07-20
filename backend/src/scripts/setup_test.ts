import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const p = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('test1234', 12);
  const user = await p.user.upsert({
    where: { email: 'apitest@test.com' },
    update: { passwordHash: hash },
    create: { email: 'apitest@test.com', username: 'apitest', passwordHash: hash },
  });
  console.log('User ready:', user.username);
}
main().catch(console.error).finally(() => p.$disconnect());
