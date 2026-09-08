import 'dotenv/config';

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../common/utils/logger.js';
import { hashPassword } from '../common/utils/password.js';
import * as userRepository from '../modules/users/user.repository.js';

const seedAdmin = async (): Promise<void> => {
  const name = process.env.ADMIN_NAME ?? 'System Admin';
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
  }

  await connectDatabase();

  const existingAdmins = await userRepository.countAdmins();

  if (existingAdmins > 0) {
    logger.warn('Admin user already exists. Seed skipped.');
    await disconnectDatabase();
    return;
  }

  const passwordHash = await hashPassword(password);
  const admin = await userRepository.createAdmin({
    name,
    email,
    passwordHash,
  });

  logger.info('Admin user created', { email: admin.email, id: admin._id.toString() });
  await disconnectDatabase();
};

void seedAdmin().catch(async (error) => {
  logger.error('Failed to seed admin user', {
    message: error instanceof Error ? error.message : String(error),
  });

  try {
    await disconnectDatabase();
  } catch {
    // ignore disconnect errors during failed seed
  }

  process.exit(1);
});
