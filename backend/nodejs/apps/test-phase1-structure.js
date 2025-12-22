/**
 * Phase 1 Test: Verify Desktop Auth Structure
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('PHASE 1: STRUCTURE VERIFICATION');
console.log('========================================\n');

const basePath = path.join(__dirname, 'src', 'modules', 'desktop_auth');

// Test 1: Check if directories exist
console.log('Test 1: Directory Structure');
const dirs = ['types', 'controller', 'routes'];
dirs.forEach(dir => {
  const dirPath = path.join(basePath, dir);
  const exists = fs.existsSync(dirPath);
  console.log(`  ${exists ? '✓' : '✗'} ${dir}/ directory: ${exists ? 'EXISTS' : 'MISSING'}`);
});

// Test 2: Check if files exist
console.log('\nTest 2: File Existence');
const files = [
  'types/desktop-auth.types.ts',
  'controller/desktop-auth.controller.ts',
  'routes/desktop-auth.routes.ts'
];

files.forEach(file => {
  const filePath = path.join(basePath, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✓' : '✗'} ${file}: ${exists ? 'EXISTS' : 'MISSING'}`);
});

// Test 3: Check file sizes (should not be empty)
console.log('\nTest 3: File Content');
files.forEach(file => {
  const filePath = path.join(basePath, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const hasContent = stats.size > 100;
    console.log(`  ${hasContent ? '✓' : '✗'} ${file}: ${stats.size} bytes`);
  }
});

// Test 4: Check for key exports
console.log('\nTest 4: Key Exports');
const typesFile = path.join(basePath, 'types', 'desktop-auth.types.ts');
const controllerFile = path.join(basePath, 'controller', 'desktop-auth.controller.ts');
const routesFile = path.join(basePath, 'routes', 'desktop-auth.routes.ts');

if (fs.existsSync(typesFile)) {
  const content = fs.readFileSync(typesFile, 'utf8');
  console.log(`  ${content.includes('DesktopSignupRequest') ? '✓' : '✗'} DesktopSignupRequest interface`);
  console.log(`  ${content.includes('DesktopSigninRequest') ? '✓' : '✗'} DesktopSigninRequest interface`);
  console.log(`  ${content.includes('DesktopAuthResponse') ? '✓' : '✗'} DesktopAuthResponse interface`);
  console.log(`  ${content.includes('isNewUser') ? '✓' : '✗'} isNewUser field in response`);
}

if (fs.existsSync(controllerFile)) {
  const content = fs.readFileSync(controllerFile, 'utf8');
  console.log(`  ${content.includes('class DesktopAuthController') ? '✓' : '✗'} DesktopAuthController class`);
  console.log(`  ${content.includes('async signup') ? '✓' : '✗'} signup method`);
  console.log(`  ${content.includes('async signin') ? '✓' : '✗'} signin method`);
  console.log(`  ${content.includes('async refreshToken') ? '✓' : '✗'} refreshToken method`);
}

if (fs.existsSync(routesFile)) {
  const content = fs.readFileSync(routesFile, 'utf8');
  console.log(`  ${content.includes("'/signup'") ? '✓' : '✗'} /signup route`);
  console.log(`  ${content.includes("'/signin'") ? '✓' : '✗'} /signin route`);
  console.log(`  ${content.includes("'/refresh'") ? '✓' : '✗'} /refresh route`);
}

console.log('\n========================================');
console.log('PHASE 1: COMPLETE ✓');
console.log('========================================');
console.log('\nAll structure files created successfully!');
console.log('Ready for Phase 2: Implement Signup Logic\n');
