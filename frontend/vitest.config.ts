import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Resolve the `@/` path alias (from tsconfig) so tests can import modules
  // that pull in value imports like `@/types/crm`, matching the app build.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: "src/setupTests.ts",
  },
});
