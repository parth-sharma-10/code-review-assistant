// Test-only configuration. Uses the separate test database created by docker-compose's init script.
process.env.DATABASE_URL ??=
  'postgresql://cra:cra_dev_password@localhost:5433/code_review_assistant_test';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.OPENAI_BASE_URL = '';
process.env.OPENAI_MODEL = '';
process.env.AI_TIMEOUT_MS = '5000';
