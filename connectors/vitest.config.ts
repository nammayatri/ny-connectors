import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    // Default isolate: true — each test file gets a fresh module registry, so the
    // config/merchant singletons (built at import from env) and the mock's
    // module-level state are rebuilt per file.
  },
});
