const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function build(app) {
  const appDir = path.join(root, app);
  console.log(`Building ${app}...`);
  execFileSync('npm', ['run', 'build'], { cwd: appDir, stdio: 'inherit' });
}

fs.rmSync(dist, { recursive: true, force: true });
build('customer-frontend');
build('admin-dashboard');

fs.cpSync(path.join(root, 'customer-frontend', 'dist'), dist, { recursive: true });
fs.mkdirSync(path.join(dist, 'admin'), { recursive: true });
fs.cpSync(path.join(root, 'admin-dashboard', 'dist'), path.join(dist, 'admin'), { recursive: true });

console.log('Vercel output prepared in dist/ (storefront at /, admin at /admin).');
