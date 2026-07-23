const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Strip android.permission.WRITE_CONTACTS from the Android manifest.
 *
 * The expo-contacts config plugin adds READ_CONTACTS and WRITE_CONTACTS
 * together, unconditionally (node_modules/expo-contacts/plugin/build/withContacts.js).
 * This app only ever READS contacts — to fill a customer's or supplier's name
 * and number into the party form — and never calls a contact write API.
 *
 * A manifest that advertises write access the code never uses is a permission
 * the owner has to grant, an app-store review question to answer, and a promise
 * the app does not need to make. So we take it back out.
 *
 * TWO removals are needed, and both are load-bearing:
 *
 *  1. The STATIC one. expo-contacts appends to `config.android.permissions`,
 *     and a core mod writes that array into the manifest AFTER every
 *     plugin-added mod has run. Removing it only inside a manifest mod is
 *     therefore useless — the core mod puts it straight back. This was
 *     observed, not assumed: a manifest-only version of this plugin left
 *     WRITE_CONTACTS in the built manifest.
 *  2. The MANIFEST one, which catches the permission if it was written
 *     directly rather than routed through `android.permissions`.
 *
 * Must be listed AFTER "expo-contacts" in app.json plugins — config plugins
 * run in array order, and this one undoes part of what that one did.
 */
const WRITE_CONTACTS = 'android.permission.WRITE_CONTACTS';

module.exports = function withoutWriteContacts(config) {
  // 1. Static: drop it from the permission list the core mod reads.
  if (Array.isArray(config.android?.permissions)) {
    config.android.permissions = config.android.permissions.filter((p) => p !== WRITE_CONTACTS);
  }

  // 2. Manifest: drop it if it reached the XML by any other route.
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (p) => p.$?.['android:name'] !== WRITE_CONTACTS,
      );
    }
    return cfg;
  });
};
