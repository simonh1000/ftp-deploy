const globals = require("globals");
const path = require("path");
const js = require("@eslint/js");
const FlatCompat = require("@eslint/eslintrc").FlatCompat;

const dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [
    {
        ignores: ["**/dist"],
    },
    ...compat.extends("eslint:recommended", "prettier"),
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.mocha,
            },

            ecmaVersion: 2020,
            sourceType: "commonjs",
        },
    }
];
