const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Logger = require('../logs/logger');

const { detectDocumentBorders } = require('./auto_crop');

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
        let inst = sharp(filePath, { failOnError: false }).rotate();
        const meta = await inst.metadata();
        const w = meta.width || 1000;
        const h = meta.height || 1000;

        // Auto-isolate card boundary from table / bedsheet / desk backgrounds
        try {
            const borders = await detectDocumentBorders(filePath);
            if (borders.hasSignificantBorders) {
                const cutLeft = Math.floor(w * (borders.leftPct / 100));
                const cutRight = Math.floor(w * (borders.rightPct / 100));
                const cutTop = Math.floor(h * (borders.topPct / 100));
                const cutBottom = Math.floor(h * (borders.bottomPct / 100));

                const extractW = Math.max(50, w - cutLeft - cutRight);
                const extractH = Math.max(50, h - cutTop - cutBottom);

                inst = inst.extract({ left: cutLeft, top: cutTop, width: extractW, height: extractH });
                Logger.info('IMAGE_PROCESSOR', `Auto-cropped ID card side (${extractW}x${extractH}) at (${cutLeft}, ${cutTop})`);
            }
        } catch (e) {
            Logger.warn('IMAGE_PROCESSOR', `Auto-crop card error: ${e.message}`);
        }

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

    // Semi-transparent diagonal watermark across both cards if requested
    if (options.watermark && String(options.watermark).trim()) {
        const cleanWatermark = String(options.watermark).trim().replace(/[<>&"']/g, '');
        const wmSvg = Buffer.from(`
            <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
                <text x="${orientation === 'vertical' ? canvasWidth / 2 : canvasWidth * 0.28}" 
                      y="${orientation === 'vertical' ? canvasHeight * 0.27 : canvasHeight / 2}" 
                      font-size="64" font-family="Arial, Helvetica, sans-serif" font-weight="bold" 
                      fill="rgba(100, 116, 139, 0.35)" text-anchor="middle" 
                      transform="rotate(-22, ${orientation === 'vertical' ? canvasWidth / 2 : canvasWidth * 0.28}, ${orientation === 'vertical' ? canvasHeight * 0.27 : canvasHeight / 2})">
                    ${cleanWatermark}
                </text>
                <text x="${orientation === 'vertical' ? canvasWidth / 2 : canvasWidth * 0.72}" 
                      y="${orientation === 'vertical' ? canvasHeight * 0.67 : canvasHeight / 2}" 
                      font-size="64" font-family="Arial, Helvetica, sans-serif" font-weight="bold" 
                      fill="rgba(100, 116, 139, 0.35)" text-anchor="middle" 
                      transform="rotate(-22, ${orientation === 'vertical' ? canvasWidth / 2 : canvasWidth * 0.72}, ${orientation === 'vertical' ? canvasHeight * 0.67 : canvasHeight / 2})">
                    ${cleanWatermark}
                </text>
            </svg>
        `);
        composites.push({ input: wmSvg, top: 0, left: 0 });
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
