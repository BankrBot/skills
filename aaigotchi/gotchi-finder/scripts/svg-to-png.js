const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function svgToPng(svgPath, pngPath, size = 512) {
  console.log(`\n🎨 Converting SVG to PNG...`);
  console.log(`📐 Input: ${svgPath}`);
  console.log(`📐 Output: ${pngPath} (${size}x${size})`);
  
  try {
    const svgBuffer = fs.readFileSync(svgPath);
    
    await sharp(svgBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(pngPath);
    
    const stats = fs.statSync(pngPath);
    console.log(`✅ PNG created: ${(stats.size / 1024).toFixed(2)} KB`);
    
    return pngPath;
  } catch (error) {
    console.error(`❌ Error converting SVG to PNG:`, error.message);
    throw error;
  }
}

// Main
async function main() {
  const svgPath = process.argv[2];
  const pngPath = process.argv[3];
  const size = parseInt(process.argv[4]) || 512;
  
  if (!svgPath || !pngPath) {
    console.log('Usage: node svg-to-png.js <svgPath> <pngPath> [size]');
    console.log('Example: node svg-to-png.js gotchi-9638.svg gotchi-9638.png 512');
    process.exit(1);
  }
  
  await svgToPng(svgPath, pngPath, size);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { svgToPng };
