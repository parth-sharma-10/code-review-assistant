import { execSync } from 'node:child_process';
import './env';

/** Applies migrations to the test database once per `npm test` run. */
export default function globalSetup() {
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env });
}
