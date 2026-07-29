const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const Logger = require('../logs/logger');
const { processPdf } = require('./pdf_processor');

const psHelperPath = path.join(__dirname, 'office_to_pdf.ps1');

async function processOffice(inputPath, outputDir, fileType, options = {}) {
    const fileName = path.basename(inputPath);
    const pdfName = `converted_${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}.pdf`;
    const tempPdfPath = path.join(outputDir, pdfName);

    Logger.logConversion(`Starting native Windows Office conversion for [${fileName}] (${fileType})`);

    return new Promise((resolve) => {
        execFile('powershell.exe', [
            '-WindowStyle', 'Hidden',
            '-ExecutionPolicy', 'Bypass',
            '-File', psHelperPath,
            '-InputPath', inputPath,
            '-OutputPath', tempPdfPath,
            '-FileType', fileType
        ], { timeout: 45000 }, async (error, stdout, stderr) => {
            if (error || !fs.existsSync(tempPdfPath)) {
                Logger.warn('OFFICE_CONVERTER', `COM automation failed or Office not installed for [${fileName}]: ${error ? error.message : stderr || 'No PDF generated'}. Passing through direct file.`);
                // Fallback: copy original file directly into processed folder
                const fallbackName = `raw_${Date.now()}_${fileName}`;
                const fallbackPath = path.join(outputDir, fallbackName);
                try { fs.copyFileSync(inputPath, fallbackPath); } catch(e){}
                resolve({ success: false, outputPath: fallbackPath, outputFileName: fallbackName, pages: 1, type: fileType, error: error ? error.message : 'Office conversion failed' });
            } else {
                Logger.logConversion(`Successfully converted ${fileName} ➔ ${pdfName}`);
                // Verify page count using our PDF processor
                const result = await processPdf(tempPdfPath, outputDir, options);
                resolve({ ...result, type: fileType });
            }
        });
    });
}

module.exports = { processOffice };
