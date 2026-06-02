#!/usr/bin/env node



const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Netflix Production Build...\n');


if (fs.existsSync('dist')) {
  console.log('🧹 Cleaning previous build...');
  fs.rmSync('dist', { recursive: true, force: true });
}


console.log('📦 Building for production...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Build failed!');
  process.exit(1);
}


const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ Build directory not found!');
  process.exit(1);
}


const jsFiles = fs.readdirSync(distDir, { recursive: true })
  .filter(file => file.endsWith('.js'))
  .map(file => path.join(distDir, file));

console.log(`\n✅ Build completed! Generated ${jsFiles.length} JavaScript files`);


jsFiles.forEach(file => {
  const stats = fs.statSync(file);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`   📄 ${path.basename(file)} (${sizeKB} KB)`);
});


console.log('\n🔒 Security checks:');


const sourceMaps = fs.readdirSync(distDir, { recursive: true })
  .filter(file => file.endsWith('.map'));

if (sourceMaps.length === 0) {
  console.log('   ✅ No source maps found');
} else {
  console.log('   ⚠️  Source maps found (should not happen in production)');
}


const unminifiedFiles = jsFiles.filter(file => {
  const content = fs.readFileSync(file, 'utf8');
  return content.includes('function') && content.includes('//') && !content.includes('minify');
});

if (unminifiedFiles.length === 0) {
  console.log('   ✅ All files appear minified');
} else {
  console.log(`   ⚠️  ${unminifiedFiles.length} files may not be fully minified`);
}

console.log('\n🎉 Production build ready!');
console.log('   Run "npm run start" to test the production build');
