import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this repo at https://<user>.github.io/Align/,
// so all built asset paths need the /Align/ prefix.
export default defineConfig({
  plugins: [react()],
  base: "/Align/",
});
