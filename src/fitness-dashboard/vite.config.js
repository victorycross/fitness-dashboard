import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Set VITE_BASE to your GitHub repo name, e.g. /fitness-dashboard/
  base: process.env.VITE_BASE || "/",
});
