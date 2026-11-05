import tseslint from "typescript-eslint";

// Safety-focused linting alongside tsc; retain existing formatting and public APIs.
export default [
  { ignores: ["node_modules/**", "dist/**", "dist-ios/**", ".expo/**", "src/styles/generated.css"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      "no-debugger": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-async-promise-executor": "error",
      "no-sparse-arrays": "error",
      "use-isnan": "error",
      "valid-typeof": "error"
    }
  }
];
