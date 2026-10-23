import { defineConfig } from "vitest/config";

// `shared` runs on both sides, so its tests run in both environments.
const sharedProject = environment => ({
  test: { name: `shared:${environment}`, root: "shared", environment },
});

export default defineConfig({
  test: {
    watch: false,
    isolate: true,
    passWithNoTests: true,
    projects: [
      "client",
      "server",
      sharedProject("node"),
      sharedProject("jsdom"),
    ],
  },
});
