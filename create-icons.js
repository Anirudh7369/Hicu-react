const fs = require('fs');

function createIconSVG(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#A076F9"/>
  <text x="50%" y="50%" font-size="${size/2}" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-weight="bold">H</text>
</svg>`;
}

// Create placeholder icons
fs.writeFileSync('public/icon-192.png.svg', createIconSVG(192));
fs.writeFileSync('public/icon-512.png.svg', createIconSVG(512));
fs.writeFileSync('public/favicon.svg', createIconSVG(32));

console.log('✅ Created placeholder icon files');
console.log('⚠️  Note: Replace SVG placeholders with proper PNG icons');
console.log('📖 See public/ICON_SETUP.md for instructions');
