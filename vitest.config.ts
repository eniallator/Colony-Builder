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

const ISOMORPHIC_ENVIRONMENTS: VitestEnvironment[] = ["node", "jsdom"];

// `shared` and `server-core` run on both sides (Node server, browser worker),
// so their tests run in both environments.
const isomorphicProjects = (name: string) =>
  ISOMORPHIC_ENVIRONMENTS.map(environment =>
    project({ name: `${name}:${environment}`, root: name, environment })
  );

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
      project({ name: "server-node", environment: "node" }),
      ...isomorphicProjects("server-core"),
      ...isomorphicProjects("shared"),
    ],
    coverage: {
      enabled: true,
      reporter: ["text-summary"],
      include: ["*/{src,worker}/**/*.ts"],
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
