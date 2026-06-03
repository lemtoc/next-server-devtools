import { defineConfig } from "vitest/config";

const testFilePattern = "**/*.{test,spec}.?(c|m)[jt]s?(x)";

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          environment: "jsdom",
          include: [`apps/docs/${testFilePattern}`],
          name: "docs",
        },
      },
      {
        extends: true,
        test: {
          environment: "jsdom",
          include: [`apps/playground/${testFilePattern}`],
          name: "playground",
        },
      },
      {
        extends: true,
        test: {
          environment: "node",
          include: [`packages/${testFilePattern}`],
          name: { color: "green", label: "packages" },
        },
      },
    ],
  },
});
