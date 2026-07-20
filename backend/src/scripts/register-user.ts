import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

async function registerTestUser() {
  const email = 'test@example.com';
  const username = 'testuser';
  const password = 'password123';

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      console.log('User already exists:', existing.email, existing.username);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        displayName: 'Test User',
      },
    });

    console.log('User registered successfully:', user.email, user.username);
  } catch (err) {
    console.error('Error registering user:', err);
  } finally {
    await prisma.$disconnect();
  }
}

registerTestUser();
