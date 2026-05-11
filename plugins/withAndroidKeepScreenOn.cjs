/** @type {import('expo/config-plugins').ConfigPlugin} */
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidKeepScreenOn(config) {
  return withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    activity.$['android:keepScreenOn'] = 'true';
    return config;
  });
};
