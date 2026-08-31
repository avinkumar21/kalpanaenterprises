const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Logger = require('../logs/logger');

const { detectDocumentBorders } = require('./auto_crop');

// A4 dimensions at 300 DPI
const A4_WIDTH = 2480;
const A4_HEIGHT = 3508;

async function processImage(inputPath, outputDir, options = {}) {
    const fileName = path.basename(inputPath);
    const outputFileName = `enhanced_${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}.png`;
    const outputPath = path.join(outputDir, outputFileName);
    
    Logger.logEnhancement(`Starting image enhancement for [${fileName}]`, { options });
    
    try {
        let instance = sharp(inputPath, { failOnError: false });
        const metadata = await instance.metadata();
        
        // Auto-rotation based on EXIF orientation
        instance = instance.rotate();

        // Intelligent Automatic Document & Subject Isolation (Slices away wooden tables, bedsheets, floors around ID cards & receipts)
        if (options.autoCrop !== false) {
            try {
                const borders = await detectDocumentBorders(inputPath);
                const origW = metadata.width || 1000;
                const origH = metadata.height || 1000;

                if (borders.hasSignificantBorders) {
                    const cutLeft = Math.floor(origW * (borders.leftPct / 100));
                    const cutRight = Math.floor(origW * (borders.rightPct / 100));
                    const cutTop = Math.floor(origH * (borders.topPct / 100));
                    const cutBottom = Math.floor(origH * (borders.bottomPct / 100));

                    const extractW = Math.max(100, origW - cutLeft - cutRight);
                    const extractH = Math.max(100, origH - cutTop - cutBottom);

                    if (extractW > 100 && extractH > 100 && (cutLeft + extractW <= origW) && (cutTop + extractH <= origH)) {
                        instance = instance.extract({ left: cutLeft, top: cutTop, width: extractW, height: extractH });
                        Logger.logEnhancement(`Accurately isolated document (${extractW}x${extractH}) from surrounding table/desk (Borders cut: T:${borders.topPct}%, B:${borders.bottomPct}%, L:${borders.leftPct}%, R:${borders.rightPct}%).`);
                    }
                } else {
                    // Subtle trim of outer camera sensor slivers (2% on each side)
                    const cutLeft = Math.floor(origW * 0.02);
                    const cutTop = Math.floor(origH * 0.02);
                    const extractW = Math.floor(origW * 0.96);
                    const extractH = Math.floor(origH * 0.96);
                    if (extractW > 100 && extractH > 100 && (cutLeft + extractW <= origW) && (cutTop + extractH <= origH)) {
                        instance = instance.extract({ left: cutLeft, top: cutTop, width: extractW, height: extractH });
                    }
                }
            } catch (e) {
                Logger.warn('IMAGE_PROCESSOR', `Auto-crop error ignored: ${e.message}`);
            }
        }

        // Apply contrast & brightness optimization based on enhancement level
        const isColor = options.colorMode === 'Color';
        if (!isColor) {
            // Default to ultra-clean, high-contrast Black & White monochrome
            instance = instance.greyscale();
        }

        const level = options.enhancementLevel || 'High';
        if (level === 'Moderate') {
            instance = instance.linear(1.15, -(0.08 * 255));
            if (isColor) instance = instance.modulate({ brightness: 1.05, saturation: 1.05 });
        } else if (level === 'High') {
            // Boosted quality: normalize white balance, sharpen text, increase contrast for crisp receipt/document printing
            instance = instance.normalize().linear(1.3, -(0.12 * 255)).sharpen({ sigma: 2 });
            if (isColor) instance = instance.modulate({ brightness: 1.08, saturation: 1.1 });
        } else if (level === 'Aggressive') {
            // Maximum white background cleaning + ultra-sharp text for ID cards and receipts
            instance = instance.normalize().linear(1.45, -(0.18 * 255)).sharpen({ sigma: 2.5 });
            if (isColor) instance = instance.modulate({ brightness: 1.12, saturation: 1.15 });
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
