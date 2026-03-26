import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/generated/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: "Hardcoded hex colors are not allowed in TS/TSX. Use CSS variables/tokens (e.g. var(--token)) instead.",
        },
        {
          selector: "Literal[value=/^(?:rgb|rgba|hsl|hsla)\\(/i]",
          message: "Hardcoded rgb/rgba/hsl/hsla colors are not allowed in TS/TSX. Use CSS variables/tokens instead.",
        },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "android/**/build/**",
    "scripts/**/*.js",
    "scripts/**/*.cjs",
    "*.js",
    "*.cjs",
    "*.mjs",
  ]),
]);

export default eslintConfig;
