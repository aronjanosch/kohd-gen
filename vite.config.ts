import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.CI ? '/kohd-gen/' : '/',
});
