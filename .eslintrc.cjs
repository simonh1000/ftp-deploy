/* eslint-env node */
module.exports = {
    extends: ['eslint:recommended', 'prettier'],
    root: true,
    parserOptions: {
        "ecmaVersion": "2020"
    },
    env: {
        node: true,
        es6: true,
        mocha: true,
    }
};
