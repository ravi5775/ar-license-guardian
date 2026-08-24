// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isProd = process.env.NODE_ENV === "production";

// Build-time fingerprinting — injected by provision-client.mjs / CI.
// Client branch builds MUST set VITE_CUSTOMER_ID and VITE_BUILD_ID.
// VITE_RELEASE_HASH is set by scripts/sign-manifest.mjs after bundle hashing.
const buildMeta = {
  "import.meta.env.VITE_CUSTOMER_ID": JSON.stringify(process.env.VITE_CUSTOMER_ID ?? ""),
  "import.meta.env.VITE_BUILD_ID": JSON.stringify(process.env.VITE_BUILD_ID ?? ""),
  "import.meta.env.VITE_RELEASE_HASH": JSON.stringify(process.env.VITE_RELEASE_HASH ?? ""),
  "import.meta.env.VITE_NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // §RE-9: Disable source maps in production so JS bundles cannot be trivially
    // reverse-engineered. Dev/preview builds keep maps for debugging.
    build: {
      sourcemap: isProd ? false : "inline",
    },
    define: buildMeta,
  },
});
