/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  appId: 'com.repo-prompt-lite.app',
  productName: 'Repo Prompt Lite',
  copyright: 'Copyright © 2023',
  asar: true,
  directories: {
    output: 'release',
    buildResources: 'build-resources',
  },
  files: [
    'out/**/*',
    'node_modules/**/*',
    'package.json',
  ],
  mac: {
    artifactName: '${productName}-${version}-${arch}.${ext}',
    category: 'public.app-category.developer-tools',
    darkModeSupport: true,
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64']
      }
    ],
    icon: 'build-resources/icon.icns',
    hardenedRuntime: true,
    entitlements: 'build-resources/entitlements.plist',
    entitlementsInherit: 'build-resources/entitlements.plist',
    gatekeeperAssess: false,
  },
  dmg: {
    artifactName: '${productName}-${version}-${arch}.${ext}',
    background: 'build-resources/dmg-background.png',
    icon: 'build-resources/icon.icns',
    iconSize: 128,
    window: {
      width: 540,
      height: 380
    },
    contents: [
      {
        x: 130,
        y: 220
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications'
      }
    ]
  },
  afterSign: 'scripts/notarize.js'
}; 