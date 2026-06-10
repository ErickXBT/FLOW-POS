const fs = require('fs');
const path = require('path');

// Delete package-lock.json and yarn.lock if they exist in the root directory
const filesToDelete = ['package-lock.json', 'yarn.lock'];
filesToDelete.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`Deleted ${file}`);
    } catch (err) {
      console.error(`Failed to delete ${file}:`, err);
    }
  }
});

// Ensure the installation is performed using pnpm
const userAgent = process.env.npm_config_user_agent || '';
if (!userAgent.startsWith('pnpm/')) {
  console.error('Use pnpm instead');
  process.exit(1);
}
