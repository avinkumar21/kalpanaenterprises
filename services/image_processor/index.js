const path = require('path');
const fs = require('fs');
const Logger = require('../logs/logger');
const { processImage } = require('./image_processor');
const { processPdf } = require('./pdf_processor');
const { processOffice } = require('./office_converter');

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp', '.tif'];
const OFFICE_EXTS = {
    '.doc': 'DOC', '.docx': 'DOCX',
    '.xls': 'XLS', '.xlsx': 'XLSX',
    '.ppt': 'PPT', '.pptx': 'PPTX'
};

async function processDocument(inputPath, outputDir, options = {}) {
    if (!fs.existsSync(inputPath)) {
        throw new Error(`File not found: ${inputPath}`);
    }
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const ext = path.extname(inputPath).toLowerCase();
    const fileName = path.basename(inputPath);
    
    Logger.info('PROCESSOR', `Analyzing format for document: ${fileName} (${ext})`);

    if (IMAGE_EXTS.includes(ext)) {
        return await processImage(inputPath, outputDir, options);
    } else if (ext === '.pdf') {
        return await processPdf(inputPath, outputDir, options);
    } else if (OFFICE_EXTS[ext]) {
        return await processOffice(inputPath, outputDir, OFFICE_EXTS[ext], options);
    } else {
        Logger.warn('PROCESSOR', `Unsupported file extension [${ext}] for ${fileName}. Copying directly without enhancement.`);
        const fallbackName = `raw_${Date.now()}_${fileName}`;
        const fallbackPath = path.join(outputDir, fallbackName);
        fs.copyFileSync(inputPath, fallbackPath);
        return { success: true, outputPath: fallbackPath, outputFileName: fallbackName, pages: 1, type: 'OTHER' };
    }
}

const { mergeIdCards } = require('./id_card_merger');
const { detectDocumentBorders, autoCropDocument } = require('./auto_crop');

module.exports = { processDocument, mergeIdCards, detectDocumentBorders, autoCropDocument };
