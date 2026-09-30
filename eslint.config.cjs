const fs = require('node:fs');
const path = require('node:path');
const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');
const yaml = require('js-yaml');

const legacyConfig = yaml.load(fs.readFileSync(path.join(__dirname, '.eslintrc.yml'), 'utf8'));

module.exports = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
}).config(legacyConfig);
