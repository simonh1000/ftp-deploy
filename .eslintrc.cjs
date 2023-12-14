/* eslint-env node */
module.exports = {
    extends: ['eslint:recommended', 'prettier'],
    root: true,
    parserOptions: {
        "ecmaVersion": "2017"
    },
    env: {
        node: true,
        es6: true,
        mocha: true,
    }
};
