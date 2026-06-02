import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["import", "vitest", "nextjs"],
  options: {
    typeAware: true,
    typeCheck: true,
  },
});
