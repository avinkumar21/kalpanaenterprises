const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs = require('fs');
const Logger = require('../logs/logger');

async function processPdf(inputPath, outputDir, options = {}) {
    const fileName = path.basename(inputPath);
    const outputFileName = `optimized_${Date.now()}_${fileName}`;
    const outputPath = path.join(outputDir, outputFileName);

    Logger.logConversion(`Starting PDF verification and optimization for [${fileName}]`);

    try {
        const dataBuffer = fs.readFileSync(inputPath);
        const pdfDoc = await PDFDocument.load(dataBuffer, { ignoreEncryption: false });
        const pagesCount = pdfDoc.getPageCount();

        // Optimize metadata and structure
        pdfDoc.setTitle(`ARKA Optimized - ${fileName}`);
        pdfDoc.setProducer('ARKA Cyber Center Print Engine');

        const optimizedPdfBytes = await pdfDoc.save({ useObjectStreams: true });
        fs.writeFileSync(outputPath, optimizedPdfBytes);

        Logger.logConversion(`Successfully verified PDF [${fileName}] (${pagesCount} pages) ➔ ${outputFileName}`);
        return { success: true, outputPath, outputFileName, pages: pagesCount, type: 'PDF' };
    } catch (error) {
        Logger.error('PDF_PROCESSOR', `Failed to optimize PDF ${fileName}: ${error.message}`);
        // Fallback: copy file
        const fallbackPath = path.join(outputDir, outputFileName);
        try { fs.copyFileSync(inputPath, fallbackPath); } catch (e) {}
        return { success: false, outputPath: fallbackPath, outputFileName, pages: 1, type: 'PDF', error: error.message };
    }
}

module.exports = { processPdf };
