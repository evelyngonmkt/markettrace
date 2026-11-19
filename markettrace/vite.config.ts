import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // separa as bibliotecas grandes para o site abrir mais rápido
        manualChunks: { supabase: ["@supabase/supabase-js"], react: ["react", "react-dom", "react-router-dom"] },
      },
    },
  },
});
