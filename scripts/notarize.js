require('dotenv').config();
const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  // Only notarize the app on Mac OS
  if (process.platform !== 'darwin') {
    console.log('Skipping notarization: Platform is not macOS');
    return;
  }
  
  // Skip if not building for production or if notarization is disabled
  if (process.env.SKIP_NOTARIZE === 'true') {
    console.log('Skipping notarization: SKIP_NOTARIZE=true');
    return;
  }
  
  // Check for required environment variables
  const { APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_ID_PASSWORD || !APPLE_TEAM_ID) {
    console.warn('Skipping notarization: Missing environment variables for Apple Developer credentials.');
    console.warn('Required: APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID');
    return;
  }
  
  console.log('Notarizing macOS application...');
  
  const appBundleId = context.packager.appInfo.info._configuration.appId;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  
  try {
    await notarize({
      tool: 'notarytool',
      appBundleId,
      appPath,
      appleId: APPLE_ID,
      appleIdPassword: APPLE_ID_PASSWORD,
      teamId: APPLE_TEAM_ID,
    });
    console.log(`Successfully notarized ${appName}`);
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
}; 