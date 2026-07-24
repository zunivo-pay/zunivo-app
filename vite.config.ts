import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    alias: {
      "@base-org/account": new URL("./src/lib/stub-base-account.ts", import.meta.url).pathname,
    },
  },
  plugins: [react()],
});
