import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this repo at https://<user>.github.io/Strut/,
// so all built asset paths need the /Strut/ prefix.
export default defineConfig({
  plugins: [react()],
  base: "/Strut/",
});
