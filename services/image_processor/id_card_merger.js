const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Logger = require('../logs/logger');

// 300 DPI Standard A4 dimensions (pixels)
const A4_PORTRAIT_W = 2480;
const A4_PORTRAIT_H = 3508;

/**
 * Merges Front and Back of an ID Card (Aadhar, PAN, Driving License, Voter ID) onto 1 single A4 sheet.
 * Supports Vertical (Top & Bottom) and Horizontal (Side by Side) layouts.
 */
async function mergeIdCards(frontPath, backPath, outputDir, options = {}) {
    if (!fs.existsSync(frontPath)) {
        throw new Error(`Front card file not found: ${frontPath}`);
    }
    if (!fs.existsSync(backPath)) {
        throw new Error(`Back card file not found: ${backPath}`);
    }
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const orientation = options.orientation || 'vertical'; // 'vertical' (top/bottom) | 'horizontal' (side-by-side)
    const colorMode = options.colorMode || 'BlackWhite'; // 'BlackWhite' | 'Color'
    const enhanceCards = options.enhance !== false; // auto whiten backgrounds & sharpen text

    const isLandscape = orientation === 'horizontal';
    const canvasWidth = isLandscape ? A4_PORTRAIT_H : A4_PORTRAIT_W; // 3508 x 2480 or 2480 x 3508
    const canvasHeight = isLandscape ? A4_PORTRAIT_W : A4_PORTRAIT_H;

    // Standard high-readability Xerox ID Card size on A4
    const targetCardWidth = isLandscape ? 1350 : 1600;
    const targetCardHeight = isLandscape ? 880 : 1020;

    Logger.info('IMAGE_PROCESSOR', `Merging 2-Sided ID Card onto 1 A4 page (Orientation: ${orientation}, Color: ${colorMode})`);

    // Helper to process individual card side with crisp text & border
    async function prepareCardBuffer(filePath) {
        let inst = sharp(filePath).rotate();

        if (colorMode === 'BlackWhite') {
            inst = inst.greyscale();
        }

        if (enhanceCards) {
            inst = inst.normalize().linear(1.2, -(0.08 * 255)).sharpen({ sigma: 1.5 });
        }

        return await inst
            .resize(targetCardWidth, targetCardHeight, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .toBuffer();
    }

    const [frontBuffer, backBuffer] = await Promise.all([
        prepareCardBuffer(frontPath),
        prepareCardBuffer(backPath)
    ]);

    const frontMeta = await sharp(frontBuffer).metadata();
    const backMeta = await sharp(backBuffer).metadata();

    let composites = [];

    if (orientation === 'vertical') {
        // Vertical layout: Top (Front) and Bottom (Back) centered on A4 Portrait
        const frontLeft = Math.round((canvasWidth - frontMeta.width) / 2);
        const frontTop = Math.round(canvasHeight * 0.12);

        const backLeft = Math.round((canvasWidth - backMeta.width) / 2);
        const backTop = Math.round(canvasHeight * 0.52);

        composites.push(
            { input: frontBuffer, top: frontTop, left: frontLeft },
            { input: backBuffer, top: backTop, left: backLeft }
        );
    } else {
        // Horizontal layout: Left (Front) and Right (Back) side-by-side on A4 Landscape
        const frontLeft = Math.round(canvasWidth * 0.08);
        const frontTop = Math.round((canvasHeight - frontMeta.height) / 2);

        const backLeft = Math.round(canvasWidth * 0.53);
        const backTop = Math.round((canvasHeight - backMeta.height) / 2);

        composites.push(
            { input: frontBuffer, top: frontTop, left: frontLeft },
            { input: backBuffer, top: backTop, left: backLeft }
        );
    }

    const outputFileName = `merged_id_${Date.now()}_${orientation}.png`;
    const outputPath = path.join(outputDir, outputFileName);

    await sharp({
        create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
        }
    })
    .composite(composites)
    .withMetadata({ density: 300 })
    .png({ quality: 100 })
    .toFile(outputPath);

    Logger.info('IMAGE_PROCESSOR', `Generated merged 2-Sided ID Card A4 document: ${outputFileName}`);

    return {
        success: true,
        outputPath,
        outputFileName,
        canvasWidth,
        canvasHeight,
        orientation,
        pages: 1
    };
}

module.exports = { mergeIdCards };
