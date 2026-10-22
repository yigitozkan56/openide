/**
 * openide - Standalone Windows .exe Builder Script
 * Packages the Electron app into dist/openide-win32-x64/openide.exe
 * and copies external config/, plugins/, and examples/ folders right next to the .exe
 * so users can customize the IDE both in-app and out-of-app.
 */

const { packager } = require('@electron/packager');
const path = require('path');
const fs = require('fs');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function buildExe() {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');

  console.log('======================================================');
  console.log('  openide - Building Windows .exe...                  ');
  console.log('======================================================');

  const appPaths = await packager({
    dir: rootDir,
    name: 'openide',
    platform: 'win32',
    arch: 'x64',
    out: distDir,
    overwrite: true,
    asar: false,
    ignore: [
      /^\/dist($|\/)/,
      /^\/\.git($|\/)/,
      /^\/\.github($|\/)/
    ]
  });

  for (const appPath of appPaths) {
    console.log('-> Copying external customization directories (config/, plugins/, examples/) next to .exe...');
    copyDirRecursive(path.join(rootDir, 'config'), path.join(appPath, 'config'));
    copyDirRecursive(path.join(rootDir, 'plugins'), path.join(appPath, 'plugins'));
    copyDirRecursive(path.join(rootDir, 'examples'), path.join(appPath, 'examples'));

    // Ensure no README.md is created or copied
    const readmeInDist = path.join(appPath, 'README.md');
    if (fs.existsSync(readmeInDist)) {
      fs.unlinkSync(readmeInDist);
    }
    const readmeInApp = path.join(appPath, 'resources', 'app', 'README.md');
    if (fs.existsSync(readmeInApp)) {
      fs.unlinkSync(readmeInApp);
    }

    console.log(`\n[SUCCESS] Standalone executable built at:\n  ${path.join(appPath, 'openide.exe')}`);
  }

  // Compile root openide.exe quick launcher if rustc is available
  try {
    const { execSync } = require('child_process');
    const launcherSrc = path.join(__dirname, 'launcher.rs');
    const rootExe = path.join(rootDir, 'openide.exe');
    if (fs.existsSync(launcherSrc)) {
      execSync(`rustc -O "${launcherSrc}" -o "${rootExe}"`, { stdio: 'ignore' });
      const pdb = path.join(rootDir, 'openide.pdb');
      if (fs.existsSync(pdb)) fs.unlinkSync(pdb);
      console.log(`[SUCCESS] Root quick-launcher executable built at:\n  ${rootExe}`);
    }
  } catch (_) {}
}

buildExe().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});
