import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: '',
      SQL_HOST: '',
      SQL_USER: '',
      SQL_PASSWORD: '',
      DEFAULT_TENANT_ID: 'tenant-default-producer-01',
      GEMINI_MODEL: 'gemini-3.6-flash',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
