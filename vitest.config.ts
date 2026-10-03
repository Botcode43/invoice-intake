import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Ensure test runner points DATABASE_URL to the isolated test database
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
