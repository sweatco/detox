const os = require('os');
const fs = require('fs');
const path = require('path');
const log = require('../../utils/logger').child({ __filename });

class FixtureManager {
  constructor(fixtures) {
    this.fixtures = fixtures;
  }

  subscribeToDeviceEvents(deviceEventsEmitter) {
    deviceEventsEmitter.on('beforeLaunchApp', this.onBeforeLaunchApp.bind(this));
  }

  async onBeforeLaunchApp({ deviceId }) {
    if (!this.fixtures) {
      return;
    }

    const simulatorPath = path.join(os.homedir(), 'Library/Developer/CoreSimulator/Devices', deviceId);
    log.debug({ event: 'APP_DIRECTORY_SEARCH' }, `simulator directory is ${simulatorPath}`);

    let latestChangedDirectoryPath = null;
    let latestChangedDirectoryModifiedAt = null;
    const simulatorApplicationsDirectory = path.join(simulatorPath, 'data/Containers/Data/Application');

    const appDirectoryNames = fs.readdirSync(simulatorApplicationsDirectory);
    appDirectoryNames.forEach(function(appDirectoryName) {
      const appDirectoryPath = path.join(simulatorApplicationsDirectory, appDirectoryName);
      log.debug({ event: 'APP_DIRECTORY_SEARCH' }, `checking ${appDirectoryPath}`);
      const stats = fs.statSync(appDirectoryPath);
      if (stats.isDirectory) {
        if (!latestChangedDirectoryModifiedAt || stats.mtime > latestChangedDirectoryModifiedAt) {
          latestChangedDirectoryPath = appDirectoryPath;
          latestChangedDirectoryModifiedAt = stats.mtime;
        }
      }
    });

    log.debug({ event: 'APP_DIRECTORY_SEARCH' }, `latest changed directory is ${latestChangedDirectoryPath}`);

    if (!latestChangedDirectoryPath) {
      return;
    }

    this.fixtures.forEach(function(fixtureConfig) {
      const { filePath, destinationDir } = fixtureConfig;
      const validDestinationDir = destinationDir ? destinationDir : '';
      const fullFixtureFilePath = path.resolve(filePath);
      if (fs.existsSync(fullFixtureFilePath)) {
        const destinationDirPath = path.join(latestChangedDirectoryPath, 'Documents', validDestinationDir);
        if (!fs.existsSync(destinationDirPath)) {
          fs.mkdirSync(destinationDirPath, { recursive: true });
        }

        const destinationPath = path.join(destinationDirPath, path.basename(filePath));
        log.debug({ event: 'FIXTURE_COPY' }, `copying ${fullFixtureFilePath} to ${destinationPath}`);
        fs.copyFileSync(fullFixtureFilePath, destinationPath);
      } else {
        log.error({ event: 'FIXTURE_COPY' }, `fixture file ${filePath} does not exist, skipping`);
      }
    });

    log.debug({ event: 'FIXTURE_COPY' }, 'done');
  }
}

module.exports = FixtureManager;
