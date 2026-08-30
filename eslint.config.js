import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Auto-generated files: never hand-edited, so lint findings here are not actionable.
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      "src/routeTree.gen.ts",
      "src/integrations/supabase/types.ts",
      "src/integrations/supabase/previewAuthStorage.ts",
      "src/integrations/supabase/client.ts",
      "src/integrations/supabase/client.server.ts",
      "src/integrations/supabase/auth-middleware.ts",
      "src/integrations/supabase/auth-attacher.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // The AR/VR glue talks to untyped third-party globals (A-Frame, MindAR,
      // WebXR vendor hooks). `any` there is deliberate, not sloppy — keep it
      // visible as a warning instead of failing CI on it.
      "@typescript-eslint/no-explicit-any": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // UI code must never talk to the database directly: all reads/writes go
    // through server functions so RLS, role checks and rate limits apply.
    files: ["src/routes/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/routes/api/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(from|rpc)$/][callee.object.name=/^(supabase|supabaseAdmin|supabasePublic)$/]",
          message:
            "Direct database access is not allowed in routes/components. Call a server function in src/lib/*.functions.ts instead.",
        },
        {
          selector: "ImportDeclaration[source.value=/client\\.server$/]",
          message:
            "The service-role Supabase client must never be imported from UI code. Use a server function.",
        },
      ],
    },
  },
  eslintPluginPrettier,
);
