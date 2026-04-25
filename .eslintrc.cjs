/* eslint-env node */
module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['/dist', '/node_modules', '/android', '/ios', '.expo'],
  settings: { 'import/ignore': ['react-native', 'expo', 'expo-.*'] },
};
