import { config } from '../config';
import logger from '../utils/logger';
import { InternalServerError } from '../utils/errors';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Adobe PDF Services for text extraction
 * Documentation: https://developer.adobe.com/document-services/docs/overview/pdf-extract-api/
 */
class AdobePDFService {
  private clientId: string;
  private clientSecret: string;
  private isConfigured: boolean;

  constructor() {
    this.clientId = config.adobe?.clientId || '';
    this.clientSecret = config.adobe?.clientSecret || '';
    this.isConfigured = !!(this.clientId && this.clientSecret);
    
    if (!this.isConfigured) {
      logger.warn('⚠️  Adobe PDF Services not configured - text extraction fallback unavailable');
    }
  }

  /**
   * Check if Adobe PDF Services is configured and available
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Extract text from PDF using Adobe PDF Services
   * This works even for image-based/scanned PDFs (includes OCR)
   */
  async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    if (!this.isConfigured) {
      throw new InternalServerError('Adobe PDF Services not configured');
    }

    try {
      logger.info('📄 Extracting text from PDF using Adobe PDF Services...');
      
      // Import Adobe SDK v4
      const {
        ServicePrincipalCredentials,
        PDFServices,
        MimeType,
        ExtractPDFParams,
        ExtractElementType,
        ExtractPDFJob,
        ExtractPDFResult,
      } = await import('@adobe/pdfservices-node-sdk');
      
      // Create credentials
      const credentials = new ServicePrincipalCredentials({
        clientId: this.clientId,
        clientSecret: this.clientSecret
      });

      // Create PDFServices instance
      const pdfServices = new PDFServices({ credentials });

      // Create temp file for input PDF
      const inputFileName = path.join(os.tmpdir(), `input-${Date.now()}.pdf`);
      fs.writeFileSync(inputFileName, pdfBuffer);

      // Create asset from local file
      const readStream = fs.createReadStream(inputFileName);
      const inputAsset = await pdfServices.upload({
        readStream,
        mimeType: MimeType.PDF
      });

      // Set options for text extraction (includes OCR for scanned documents)
      const params = new ExtractPDFParams({
        elementsToExtract: [ExtractElementType.TEXT]
      });

      // Create and execute the job
      const job = new ExtractPDFJob({ inputAsset, params });
      const pollingURL = await pdfServices.submit({ job });
      const pdfServicesResponse = await pdfServices.getJobResult({
        pollingURL,
        resultType: ExtractPDFResult
      });

      // Get result asset
      const resultAsset = pdfServicesResponse.result?.resource;
      if (!resultAsset) {
        throw new Error('No result from Adobe PDF Services');
      }
      
      const streamAsset = await pdfServices.getContent({ asset: resultAsset });

      // Create temp output path
      const outputZipPath = path.join(os.tmpdir(), `output-${Date.now()}.zip`);
      const outputStream = fs.createWriteStream(outputZipPath);
      
      streamAsset.readStream.pipe(outputStream);
      await new Promise<void>((resolve, reject) => {
        outputStream.on('finish', () => resolve());
        outputStream.on('error', reject);
      });

      // Extract the JSON from the zip
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(outputZipPath);
      const zipEntries = zip.getEntries();
      
      let extractedText = '';
      
      // Find structuredData.json in the zip
      for (const entry of zipEntries) {
        if (entry.entryName === 'structuredData.json') {
          const jsonContent = JSON.parse(entry.getData().toString('utf8'));
          
          // Extract text from all elements
          if (jsonContent.elements) {
            for (const element of jsonContent.elements) {
              if (element.Text) {
                extractedText += element.Text + ' ';
              }
            }
          }
          break;
        }
      }

      // Cleanup temp files
      try {
        fs.unlinkSync(inputFileName);
        fs.unlinkSync(outputZipPath);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp files:', cleanupError);
      }

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('Adobe extraction produced insufficient text');
      }

      logger.info(`✅ Adobe PDF extraction successful (${extractedText.length} chars)`);
      return extractedText.trim();

    } catch (error: any) {
      logger.error('Adobe PDF extraction error:', error);
      throw new InternalServerError(`Adobe PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF with retry logic
   */
  async extractTextWithRetry(pdfBuffer: Buffer, maxRetries: number = 2): Promise<string> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Adobe PDF extraction attempt ${attempt}/${maxRetries}`);
        return await this.extractTextFromPDF(pdfBuffer);
      } catch (error: any) {
        lastError = error;
        logger.error(`Adobe extraction attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, attempt) * 1000;
          logger.info(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError || new Error('Adobe PDF extraction failed after all retries');
  }
}

export default new AdobePDFService();
