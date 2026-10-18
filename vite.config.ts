import path from "path";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(({ command }) => {
  // Cloudflare Workers plugin only on build (produces the worker output);
  // the workerd runtime isn't available for the dev server.
  const useCloudflare = command === "build";

  return {
    server: {
      host: "::",
      port: 8080,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      ...(useCloudflare ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
      tanstackStart(),
      viteReact(),
    ],
  };
});
