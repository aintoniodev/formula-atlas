import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3016",
    headless: true,
    viewport: { width: 1440, height: 960 },
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3016",
    reuseExistingServer: !process.env.CI,
  },
});
