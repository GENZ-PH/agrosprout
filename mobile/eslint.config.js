// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*"] },
  {
    // The rotation engine is pure TypeScript (docs/06-architecture.md, #22):
    // it must run offline on Android, on web, and in Node tests.
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-native", "react-native-*", "expo", "expo-*", "@expo/*", "@react-native*"],
              message: "src/engine must stay pure TypeScript (no React, React Native, or Expo imports).",
            },
          ],
        },
      ],
    },
  },
]);
