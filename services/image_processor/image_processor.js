const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Logger = require('../logs/logger');

// A4 dimensions at 300 DPI
const A4_WIDTH = 2480;
const A4_HEIGHT = 3508;

async function processImage(inputPath, outputDir, options = {}) {
    const fileName = path.basename(inputPath);
    const outputFileName = `enhanced_${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}.png`;
    const outputPath = path.join(outputDir, outputFileName);
    
    Logger.logEnhancement(`Starting image enhancement for [${fileName}]`, { options });
    
    try {
        let instance = sharp(inputPath);
        const metadata = await instance.metadata();
        
        // Auto-rotation based on EXIF orientation
        instance = instance.rotate();

        // Intelligent Automatic Document & Subject Isolation (Slices away wooden tables, bedsheets, floors around ID cards & receipts)
        if (options.autoCrop !== false) {
            try {
                // Downsample to 200x200 raw greyscale buffer for rapid contrast boundary analysis
                const thumbBuffer = await sharp(inputPath).rotate().resize(200, 200, { fit: 'fill' }).greyscale().raw().toBuffer();
                
                // Calculate reference ambient background lightness from outermost edges (the table/floor)
                let topBg = 0, bottomBg = 0, leftBg = 0, rightBg = 0;
                for (let x = 0; x < 200; x++) {
                    topBg += thumbBuffer[x];
                    bottomBg += thumbBuffer[199 * 200 + x];
                }
                topBg /= 200; bottomBg /= 200;
                for (let y = 0; y < 200; y++) {
                    leftBg += thumbBuffer[y * 200];
                    rightBg += thumbBuffer[y * 200 + 199];
                }
                leftBg /= 200; rightBg /= 200;
                
                // Scan inwards to detect actual bright paper document boundaries (Aadhar card, PAN, tax receipt)
                let startY = 0, endY = 200, startX = 0, endX = 200;
                for (let y = 0; y < 90; y++) {
                    let diffCount = 0;
                    for (let x = 10; x < 190; x++) {
                        const val = thumbBuffer[y * 200 + x];
                        if (Math.abs(val - topBg) > 16 || val > 175) diffCount++;
                    }
                    if (diffCount > 18) { startY = y; break; }
                }
                for (let y = 199; y > 110; y--) {
                    let diffCount = 0;
                    for (let x = 10; x < 190; x++) {
                        const val = thumbBuffer[y * 200 + x];
                        if (Math.abs(val - bottomBg) > 16 || val > 175) diffCount++;
                    }
                    if (diffCount > 18) { endY = y; break; }
                }
                for (let x = 0; x < 90; x++) {
                    let diffCount = 0;
                    for (let y = 10; y < 190; y++) {
                        const val = thumbBuffer[y * 200 + x];
                        if (Math.abs(val - leftBg) > 16 || val > 175) diffCount++;
                    }
                    if (diffCount > 18) { startX = x; break; }
                }
                for (let x = 199; x > 110; x--) {
                    let diffCount = 0;
                    for (let y = 10; y < 190; y++) {
                        const val = thumbBuffer[y * 200 + x];
                        if (Math.abs(val - rightBg) > 16 || val > 175) diffCount++;
                    }
                    if (diffCount > 18) { endX = x; break; }
                }

                // If a clean document subject bounding box is isolated inside table boundaries
                const docWidth = endX - startX;
                const docHeight = endY - startY;
                const origW = metadata.width || 1000;
                const origH = metadata.height || 1000;

                if (docWidth > 30 && docHeight > 30 && (startX > 2 || startY > 2 || endX < 198 || endY < 198)) {
                    const leftPct = Math.max(0, (startX - 2)) / 200;
                    const topPct = Math.max(0, (startY - 2)) / 200;
                    const widthPct = Math.min(1 - leftPct, (docWidth + 4) / 200);
                    const heightPct = Math.min(1 - topPct, (docHeight + 4) / 200);
                    
                    const extractLeft = Math.floor(origW * leftPct);
                    const extractTop = Math.floor(origH * topPct);
                    const extractW = Math.floor(origW * widthPct);
                    const extractH = Math.floor(origH * heightPct);

                    if (extractW > 100 && extractH > 100 && (extractLeft + extractW <= origW) && (extractTop + extractH <= origH)) {
                        instance = instance.extract({ left: extractLeft, top: extractTop, width: extractW, height: extractH });
                        Logger.logEnhancement(`Accurately isolated document subject (${extractW}x${extractH}) from surrounding table background.`);
                    }
                } else {
                    // Fallback automatic trim of outer table margins
                    const extractLeft = Math.floor(origW * 0.04);
                    const extractTop = Math.floor(origH * 0.04);
                    const extractW = Math.floor(origW * 0.92);
                    const extractH = Math.floor(origH * 0.92);
                    if (extractW > 100 && extractH > 100 && (extractLeft + extractW <= origW) && (extractTop + extractH <= origH)) {
                        instance = instance.extract({ left: extractLeft, top: extractTop, width: extractW, height: extractH });
                    }
                }
            } catch (e) {
                try { instance = instance.trim({ threshold: 35 }); } catch (err) {}
            }
        }

        // Apply contrast & brightness optimization based on enhancement level
        const level = options.enhancementLevel || 'High';
        if (level === 'Moderate') {
            instance = instance.linear(1.15, -(0.08 * 255)).modulate({ brightness: 1.05, saturation: 1.05 });
        } else if (level === 'High') {
            // Boosted quality: normalize white balance, sharpen text, increase contrast for crisp receipt/document printing
            instance = instance.normalize().linear(1.3, -(0.12 * 255)).sharpen({ sigma: 2 }).modulate({ brightness: 1.08, saturation: 1.1 });
        } else if (level === 'Aggressive') {
            // Maximum white background cleaning + ultra-sharp text for ID cards and receipts
            instance = instance.normalize().linear(1.45, -(0.18 * 255)).sharpen({ sigma: 2.5 }).modulate({ brightness: 1.12, saturation: 1.15 });
        } else if (level === 'Low') {
            instance = instance.linear(1.05, -(0.03 * 255));
        }

        // Always convert to 300 DPI and fit onto clean A4 canvas while maintaining aspect ratio
        const isLandscape = (metadata.width || 0) > (metadata.height || 0);
        const targetWidth = isLandscape ? A4_HEIGHT : A4_WIDTH;
        const targetHeight = isLandscape ? A4_WIDTH : A4_HEIGHT;

        await instance
            .resize({
                width: Math.floor(targetWidth * 0.95), // minimal margins
                height: Math.floor(targetHeight * 0.95),
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .extend({
                top: Math.floor(targetHeight * 0.025),
                bottom: Math.floor(targetHeight * 0.025),
                left: Math.floor(targetWidth * 0.025),
                right: Math.floor(targetWidth * 0.025),
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .withMetadata({ density: 300 })
            .png({ quality: 100 })
            .toFile(outputPath);

        Logger.logEnhancement(`Successfully enhanced image and generated 300 DPI A4 copy: ${outputFileName}`);
        return { success: true, outputPath, outputFileName, pages: 1, type: 'IMAGE' };
    } catch (error) {
        Logger.error('IMAGE_PROCESSOR', `Failed to process image ${fileName}: ${error.message}`);
        // Fallback: copy unmodified
        const fallbackName = `copy_${Date.now()}_${fileName}`;
        const fallbackPath = path.join(outputDir, fallbackName);
        fs.copyFileSync(inputPath, fallbackPath);
        return { success: false, outputPath: fallbackPath, outputFileName: fallbackName, pages: 1, type: 'IMAGE', error: error.message };
    }
}

module.exports = { processImage };
