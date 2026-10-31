// build-store-package.js - builds the APPX/MSIX package for the Microsoft Store,
// merging identity values from build/store-identity.json (see STORE_SUBMISSION.md).
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = __dirname;

const identity = JSON.parse(
  fs.readFileSync(path.join(root, "..", "build", "store-identity.json"), "utf8")
);

async function main() {
  const electronBuilder = require("electron-builder");
  const { Platform, Arch } = electronBuilder;
  const config = {
    appId: "com.boardroomlogic.app",
    productName: "Boardroom Logic",
    directories: {
      buildResources: path.join(root, "..", "build"),
      output: "release",
    },
    files: ["src/**/*", "vendor/**/*"],
    appx: {
      identityName: identity.identityName,
      publisher: identity.publisher,
      publisherDisplayName: identity.publisherDisplayName,
      applicationId: "BoardroomLogic",
      displayName: "Boardroom Logic",
      languages: ["en-US"],
      showNameOnTiles: true,
      setBuildNumber: false,
      artifactName: "BoardroomLogic-${version}-${arch}.appx",
    },
    win: {
      icon: path.join(root, "..", "build", "icon.ico"),
    },
    publish: null,
  };
  await electronBuilder.build({
    config,
    targets: Platform.WINDOWS.createTarget(["appx"], Arch.x64),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
