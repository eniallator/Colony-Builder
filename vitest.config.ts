import {
  defineConfig,
  type TestProjectInlineConfiguration,
} from "vitest/config";
import type { VitestEnvironment } from "vitest/node";

type ProjectOptions = NonNullable<TestProjectInlineConfiguration["test"]> & {
  name: string;
};

// Every project is inline so it inherits this file's options (notably
// `watch: false`). A project loaded from its own config file doesn't, and falls
// back to vitest's default of watching whenever the terminal is interactive.
const project = ({
  name,
  root = name,
  ...options
}: ProjectOptions): TestProjectInlineConfiguration => ({
  test: { name, root, ...options },
});

// `shared` runs on both sides, so its tests run in both environments.
const sharedProject = (environment: VitestEnvironment) =>
  project({ name: `shared:${environment}`, root: "shared", environment });

export default defineConfig({
  test: {
    watch: false,
    isolate: true,
    passWithNoTests: true,
    projects: [
      project({
        name: "client",
        environment: "jsdom",
        setupFiles: ["vitest-canvas-mock"],
      }),
      project({ name: "server", environment: "node" }),
      sharedProject("node"),
      sharedProject("jsdom"),
    ],
    coverage: {
      enabled: true,
      reporter: ["text-summary"],
      include: [
        "client/src/**/*.ts",
        "server/src/**/*.ts",
        "shared/src/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        // Rendering is placeholder code for now; remove this once it's final.
        "client/src/render/**",
      ],
      thresholds: {
        statements: 100,
        functions: 100,
        branches: 100,
        lines: 100,
        perFile: true,
        autoUpdate: true,
      },
    },
  },
});
