const sharp = require('sharp');
const fs = require('fs');
const Logger = require('../logs/logger');

/**
 * Intelligent Document Edge & Boundary Detection Engine
 * Accurately isolates paper documents (Aadhar, PAN, certificates, receipts, bills, notes)
 * from surrounding backgrounds (wooden desks, dark tables, white sheets, scanner beds, mousepads).
 */
async function detectDocumentBorders(imagePathOrBuffer) {
    const W = 160;
    const H = 160;

    try {
        // Read input and downsample to 160x160 RGB thumbnail
        const rgbThumb = await sharp(imagePathOrBuffer, { failOnError: false })
            .rotate()
            .resize(W, H, { fit: 'fill' })
            .raw()
            .toBuffer();

        // 1. Detect background color by sampling the 4 outer corner zones (8x8 pixel blocks)
        let cornerR = 0, cornerG = 0, cornerB = 0, cornerCount = 0;
        const sampleCorner = (startX, startY) => {
            for (let dy = 0; dy < 8; dy++) {
                for (let dx = 0; dx < 8; dx++) {
                    const idx = ((startY + dy) * W + (startX + dx)) * 3;
                    cornerR += rgbThumb[idx];
                    cornerG += rgbThumb[idx + 1];
                    cornerB += rgbThumb[idx + 2];
                    cornerCount++;
                }
            }
        };

        sampleCorner(2, 2);              // Top-left
        sampleCorner(W - 10, 2);         // Top-right
        sampleCorner(2, H - 10);         // Bottom-left
        sampleCorner(W - 10, H - 10);    // Bottom-right

        const bgR = cornerR / cornerCount;
        const bgG = cornerG / cornerCount;
        const bgB = cornerB / cornerCount;
        const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
        const isLightBg = bgLum > 180;

        // 2. Classify if a thumbnail pixel belongs to document content vs ambient background
        const isContentPixel = (x, y) => {
            const idx = (y * W + x) * 3;
            const r = rgbThumb[idx];
            const g = rgbThumb[idx + 1];
            const b = rgbThumb[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            if (isLightBg) {
                // Light or pure white background: content has lower luminance or color deviation from background
                const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
                return lum < 235 || diff > 24;
            } else {
                // Dark or wooden desk: paper document is much brighter or distinct color
                const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
                return lum > Math.min(215, bgLum + 32) || diff > 40;
            }
        };

        // 3. Scan row-by-row and column-by-column to find document bounding box
        let topRow = 0;
        let bottomRow = H - 1;
        const minContentPixelsPerRow = Math.max(3, Math.round(W * 0.045)); // ~4.5% of row width

        for (let y = 0; y < H; y++) {
            let count = 0;
            for (let x = 0; x < W; x++) {
                if (isContentPixel(x, y)) count++;
            }
            if (count >= minContentPixelsPerRow) {
                topRow = y;
                break;
            }
        }

        for (let y = H - 1; y >= 0; y--) {
            let count = 0;
            for (let x = 0; x < W; x++) {
                if (isContentPixel(x, y)) count++;
            }
            if (count >= minContentPixelsPerRow) {
                bottomRow = y;
                break;
            }
        }

        let leftCol = 0;
        let rightCol = W - 1;
        const minContentPixelsPerCol = Math.max(3, Math.round(H * 0.045));

        for (let x = 0; x < W; x++) {
            let count = 0;
            for (let y = 0; y < H; y++) {
                if (isContentPixel(x, y)) count++;
            }
            if (count >= minContentPixelsPerCol) {
                leftCol = x;
                break;
            }
        }

        for (let x = W - 1; x >= 0; x--) {
            let count = 0;
            for (let y = 0; y < H; y++) {
                if (isContentPixel(x, y)) count++;
            }
            if (count >= minContentPixelsPerCol) {
                rightCol = x;
                break;
            }
        }

        // Convert detected thumbnail coordinates into percentage of original dimensions
        const rawTopPct = Math.max(0, Math.round((topRow / H) * 100));
        const rawBottomPct = Math.max(0, Math.round(((H - 1 - bottomRow) / H) * 100));
        const rawLeftPct = Math.max(0, Math.round((leftCol / W) * 100));
        const rawRightPct = Math.max(0, Math.round(((W - 1 - rightCol) / W) * 100));

        // Add 1.5% breathing room so text/stamps at the very edge are never clipped
        const safeTopPct = Math.max(0, rawTopPct > 2 ? rawTopPct - 1 : 0);
        const safeBottomPct = Math.max(0, rawBottomPct > 2 ? rawBottomPct - 1 : 0);
        const safeLeftPct = Math.max(0, rawLeftPct > 2 ? rawLeftPct - 1 : 0);
        const safeRightPct = Math.max(0, rawRightPct > 2 ? rawRightPct - 1 : 0);

        const totalBorderCut = safeTopPct + safeBottomPct + safeLeftPct + safeRightPct;
        const hasSignificantBorders = totalBorderCut >= 5;

        return {
            topPct: safeTopPct,
            bottomPct: safeBottomPct,
            leftPct: safeLeftPct,
            rightPct: safeRightPct,
            widthPct: 100 - safeLeftPct - safeRightPct,
            heightPct: 100 - safeTopPct - safeBottomPct,
            hasSignificantBorders,
            bgLum: Math.round(bgLum),
            isLightBg
        };
    } catch (err) {
        Logger.warn('DOC_CROPPER', `Border detection error: ${err.message}. Defaulting to full frame.`);
        return {
            topPct: 0,
            bottomPct: 0,
            leftPct: 0,
            rightPct: 0,
            widthPct: 100,
            heightPct: 100,
            hasSignificantBorders: false
        };
    }
}

/**
 * Automatically crops image to detected document borders and refits onto A4 canvas
 */
async function autoCropDocument(inputPathOrBuffer, outputPath, options = {}) {
    const borders = await detectDocumentBorders(inputPathOrBuffer);
    const meta = await sharp(inputPathOrBuffer, { failOnError: false }).metadata();
    const w = meta.width || 1000;
    const h = meta.height || 1000;

    let cutLeft = 0;
    let cutRight = 0;
    let cutTop = 0;
    let cutBottom = 0;

    if (options.manualBorders) {
        cutLeft = Math.floor(w * ((options.manualBorders.leftPct || 0) / 100));
        cutRight = Math.floor(w * ((options.manualBorders.rightPct || 0) / 100));
        cutTop = Math.floor(h * ((options.manualBorders.topPct || 0) / 100));
        cutBottom = Math.floor(h * ((options.manualBorders.bottomPct || 0) / 100));
    } else if (borders.hasSignificantBorders) {
        cutLeft = Math.floor(w * (borders.leftPct / 100));
        cutRight = Math.floor(w * (borders.rightPct / 100));
        cutTop = Math.floor(h * (borders.topPct / 100));
        cutBottom = Math.floor(h * (borders.bottomPct / 100));
    } else {
        // Subtle fallback trim (2% all around)
        cutLeft = Math.floor(w * 0.02);
        cutRight = Math.floor(w * 0.02);
        cutTop = Math.floor(h * 0.02);
        cutBottom = Math.floor(h * 0.02);
    }

    const extractW = Math.max(50, w - cutLeft - cutRight);
    const extractH = Math.max(50, h - cutTop - cutBottom);

    let instance = sharp(inputPathOrBuffer, { failOnError: false })
        .rotate()
        .extract({ left: cutLeft, top: cutTop, width: extractW, height: extractH });

    if (options.fitToA4 !== false) {
        // Fit onto clean high-resolution canvas
        const targetW = options.targetWidth || w;
        const targetH = options.targetHeight || h;

        instance = instance
            .resize({
                width: Math.floor(targetW * 0.96),
                height: Math.floor(targetH * 0.96),
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .extend({
                top: Math.floor(targetH * 0.02),
                bottom: Math.floor(targetH * 0.02),
                left: Math.floor(targetW * 0.02),
                right: Math.floor(targetW * 0.02),
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            });
    }

    if (options.colorMode === 'BlackWhite') {
        instance = instance.greyscale();
    }

    if (outputPath) {
        await instance.png({ quality: 100 }).toFile(outputPath);
        return { success: true, outputPath, borders };
    } else {
        const buffer = await instance.png({ quality: 100 }).toBuffer();
        return { success: true, buffer, borders };
    }
}

module.exports = {
    detectDocumentBorders,
    autoCropDocument
};
