const fs = require("node:fs/promises");
const path = require("node:path");

const { transformFileAsync } = require("@babel/core");

const clientDir = path.resolve(__dirname, "..");
const vendorDir = path.join(clientDir, "vendor");

async function copyVendorFile(packageName, sourceFile, outputFile) {
  const sourcePath = path.join(clientDir, "node_modules", packageName, "umd", sourceFile);
  const targetPath = path.join(vendorDir, outputFile);
  await fs.copyFile(sourcePath, targetPath);
}

async function buildApp() {
  await fs.mkdir(vendorDir, { recursive: true });

  const appSource = path.join(clientDir, "app.jsx");
  const appTarget = path.join(clientDir, "app.js");
  const transformed = await transformFileAsync(appSource, {
    presets: ["@babel/preset-react"],
    comments: false,
    minified: false,
    compact: false,
  });

  if (!transformed?.code) {
    throw new Error("Client build failed: Babel returned no output.");
  }

  await fs.writeFile(appTarget, transformed.code, "utf8");
  await copyVendorFile("react", "react.production.min.js", "react.production.min.js");
  await copyVendorFile("react-dom", "react-dom.production.min.js", "react-dom.production.min.js");

  console.log("Client build completed");
}

buildApp().catch((error) => {
  console.error(error);
  process.exit(1);
});
