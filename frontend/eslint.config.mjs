import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Project standard: short functions everywhere.
    rules: {
      "max-lines-per-function": ["error", { max: 100, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Complexity ≤ 8 applies to logic modules. React components are exempt: cyclomatic complexity
    // counts every `cond && <X/>` and ternary in JSX, so it measures conditional rendering rather
    // than branching logic. Components are kept small by the line limit above instead.
    files: ["src/lib/**/*.ts", "src/proxy.ts"],
    rules: { complexity: ["error", 8] },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "max-lines-per-function": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
