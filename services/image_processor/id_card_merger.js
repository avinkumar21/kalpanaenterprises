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

        return await inst.toBuffer();
    }

    const [frontBuffer, backBuffer] = await Promise.all([
        prepareCardBuffer(frontPath),
        prepareCardBuffer(backPath)
    ]);

    const frontMeta = await sharp(frontBuffer).metadata();
    const backMeta = await sharp(backBuffer).metadata();

    const padding = options.padding !== undefined ? Math.round((Number(options.padding) / 20) * 80) : 60;
    const gap = options.gap !== undefined ? Math.round((Number(options.gap) / 20) * 80) : 60;

    let composites = [];

    if (orientation === 'horizontal') {
        // Landscape side-by-side: Split A4 into 2 equal halves
        const halfWidth = Math.floor((canvasWidth - (padding * 2) - gap) / 2);
        const availHeight = Math.floor(canvasHeight - (padding * 2));

        // Front Card scaling
        const frontScale = Math.min(halfWidth / frontMeta.width, availHeight / frontMeta.height);
        const frontW = Math.round(frontMeta.width * frontScale);
        const frontH = Math.round(frontMeta.height * frontScale);
        const scaledFront = await sharp(frontBuffer).resize(frontW, frontH).toBuffer();
        const frontLeft = Math.round(padding + (halfWidth - frontW) / 2);
        const frontTop = Math.round(padding + (availHeight - frontH) / 2);

        // Back Card scaling
        const backScale = Math.min(halfWidth / backMeta.width, availHeight / backMeta.height);
        const backW = Math.round(backMeta.width * backScale);
        const backH = Math.round(backMeta.height * backScale);
        const scaledBack = await sharp(backBuffer).resize(backW, backH).toBuffer();
        const backLeft = Math.round(padding + halfWidth + gap + (halfWidth - backW) / 2);
        const backTop = Math.round(padding + (availHeight - backH) / 2);

        composites.push(
            { input: scaledFront, top: frontTop, left: frontLeft },
            { input: scaledBack, top: backTop, left: backLeft }
        );
    } else {
        // Portrait vertical layout: Split A4 into top & bottom halves
        const availWidth = Math.floor(canvasWidth - (padding * 2));
        const halfHeight = Math.floor((canvasHeight - (padding * 2) - gap) / 2);

        // Front Card scaling
        const frontScale = Math.min(availWidth / frontMeta.width, halfHeight / frontMeta.height);
        const frontW = Math.round(frontMeta.width * frontScale);
        const frontH = Math.round(frontMeta.height * frontScale);
        const scaledFront = await sharp(frontBuffer).resize(frontW, frontH).toBuffer();
        const frontLeft = Math.round(padding + (availWidth - frontW) / 2);
        const frontTop = Math.round(padding + (halfHeight - frontH) / 2);

        // Back Card scaling
        const backScale = Math.min(availWidth / backMeta.width, halfHeight / backMeta.height);
        const backW = Math.round(backMeta.width * backScale);
        const backH = Math.round(backMeta.height * backScale);
        const scaledBack = await sharp(backBuffer).resize(backW, backH).toBuffer();
        const backLeft = Math.round(padding + (availWidth - backW) / 2);
        const backTop = Math.round(padding + halfHeight + gap + (halfHeight - backH) / 2);

        composites.push(
            { input: scaledFront, top: frontTop, left: frontLeft },
            { input: scaledBack, top: backTop, left: backLeft }
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
