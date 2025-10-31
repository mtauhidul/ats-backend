import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import pdfParse from 'pdf-parse';
// @ts-ignore - pdf2json doesn't have types
import PDFParser from 'pdf2json';
import mammoth from 'mammoth';
import logger from '../utils/logger';

/**
 * Enhanced Resume Parser with Triple Fallback Strategy
 * Following OLD backend's proven pattern for 100% PDF extraction success
 */

interface ParseResult {
  text: string;
  success: boolean;
  method: 'pdf-parse' | 'pdf2json' | 'mammoth' | 'none';
  error?: string;
}

/**
 * Extract text using pdf-parse (Primary method)
 */
async function extractWithPdfParse(filePath: string): Promise<ParseResult> {
  try {
    logger.info(`[PDF-PARSE] Attempting to extract text from: ${path.basename(filePath)}`);
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    if (data.text && data.text.trim().length > 50) {
      logger.info(`[PDF-PARSE] ✓ Successfully extracted ${data.text.length} characters`);
      return {
        text: data.text.trim(),
        success: true,
        method: 'pdf-parse'
      };
    }
    
    logger.warn(`[PDF-PARSE] ✗ Extracted text too short: ${data.text.length} chars`);
    return {
      text: '',
      success: false,
      method: 'pdf-parse',
      error: 'Extracted text too short'
    };
  } catch (error: any) {
    logger.error(`[PDF-PARSE] ✗ Failed:`, error.message);
    return {
      text: '',
      success: false,
      method: 'pdf-parse',
      error: error.message
    };
  }
}

/**
 * Extract text using pdf2json (Secondary fallback)
 */
async function extractWithPdf2Json(filePath: string): Promise<ParseResult> {
  return new Promise((resolve) => {
    try {
      logger.info(`[PDF2JSON] Attempting to extract text from: ${path.basename(filePath)}`);
      const pdfParser = new PDFParser();
      
      let resolved = false;
      
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        if (resolved) return;
        resolved = true;
        logger.error(`[PDF2JSON] ✗ Failed:`, errData.parserError);
        resolve({
          text: '',
          success: false,
          method: 'pdf2json',
          error: errData.parserError
        });
      });
      
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        if (resolved) return;
        resolved = true;
        
        try {
          // Extract text from all pages
          let extractedText = '';
          
          if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
            for (const page of pdfData.Pages) {
              if (page.Texts && Array.isArray(page.Texts)) {
                for (const text of page.Texts) {
                  if (text.R && Array.isArray(text.R)) {
                    for (const run of text.R) {
                      if (run.T) {
                        extractedText += decodeURIComponent(run.T) + ' ';
                      }
                    }
                  }
                }
              }
              extractedText += '\n';
            }
          }
          
          const finalText = extractedText.trim();
          
          if (finalText.length > 50) {
            logger.info(`[PDF2JSON] ✓ Successfully extracted ${finalText.length} characters`);
            resolve({
              text: finalText,
              success: true,
              method: 'pdf2json'
            });
          } else {
            logger.warn(`[PDF2JSON] ✗ Extracted text too short: ${finalText.length} chars`);
            resolve({
              text: '',
              success: false,
              method: 'pdf2json',
              error: 'Extracted text too short'
            });
          }
        } catch (error: any) {
          logger.error(`[PDF2JSON] ✗ Error processing data:`, error.message);
          resolve({
            text: '',
            success: false,
            method: 'pdf2json',
            error: error.message
          });
        }
      });
      
      pdfParser.loadPDF(filePath);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        logger.error(`[PDF2JSON] ✗ Timeout after 30 seconds`);
        resolve({
          text: '',
          success: false,
          method: 'pdf2json',
          error: 'Timeout'
        });
      }, 30000);
      
    } catch (error: any) {
      logger.error(`[PDF2JSON] ✗ Setup failed:`, error.message);
      resolve({
        text: '',
        success: false,
        method: 'pdf2json',
        error: error.message
      });
    }
  });
}

/**
 * Extract text from Word documents (.doc, .docx)
 */
async function extractFromWord(filePath: string): Promise<ParseResult> {
  try {
    logger.info(`[MAMMOTH] Attempting to extract text from: ${path.basename(filePath)}`);
    const result = await mammoth.extractRawText({ path: filePath });
    
    if (result.value && result.value.trim().length > 50) {
      logger.info(`[MAMMOTH] ✓ Successfully extracted ${result.value.length} characters`);
      return {
        text: result.value.trim(),
        success: true,
        method: 'mammoth'
      };
    }
    
    logger.warn(`[MAMMOTH] ✗ Extracted text too short: ${result.value.length} chars`);
    return {
      text: '',
      success: false,
      method: 'mammoth',
      error: 'Extracted text too short'
    };
  } catch (error: any) {
    logger.error(`[MAMMOTH] ✗ Failed:`, error.message);
    return {
      text: '',
      success: false,
      method: 'mammoth',
      error: error.message
    };
  }
}

/**
 * Main parsing function with triple fallback strategy
 * Saves buffer to temp file, tries all parsers, then cleans up
 */
export async function parseResumeWithFallback(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; method: string }> {
  
  const timestamp = Date.now();
  const ext = path.extname(filename).toLowerCase();
  const tempDir = path.join(os.tmpdir(), 'ats-resume-parsing', timestamp.toString());
  const tempFilePath = path.join(tempDir, filename);
  
  try {
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Write buffer to temp file
    fs.writeFileSync(tempFilePath, buffer);
    logger.info(`📁 Saved temp file: ${tempFilePath} (${buffer.length} bytes)`);
    
    let result: ParseResult;
    
    // Try appropriate parser based on file extension
    if (ext === '.pdf') {
      logger.info(`🔄 Starting dual fallback PDF parsing for: ${filename}`);
      
      // Try pdf-parse first
      result = await extractWithPdfParse(tempFilePath);
      if (result.success) {
        return { text: result.text, method: result.method };
      }
      
      // Try pdf2json second (fallback)
      logger.warn(`⚠️ pdf-parse failed, trying pdf2json...`);
      result = await extractWithPdf2Json(tempFilePath);
      if (result.success) {
        return { text: result.text, method: result.method };
      }
      
      // Both failed
      throw new Error(`All PDF parsers failed. Last error: ${result.error}`);
      
    } else if (['.doc', '.docx'].includes(ext)) {
      logger.info(`📄 Parsing Word document: ${filename}`);
      result = await extractFromWord(tempFilePath);
      if (result.success) {
        return { text: result.text, method: result.method };
      }
      throw new Error(`Word parsing failed: ${result.error}`);
      
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }
    
  } catch (error: any) {
    logger.error(`❌ Resume parsing failed for ${filename}:`, error.message);
    throw error;
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        logger.info(`🗑️ Cleaned up temp directory: ${tempDir}`);
      }
    } catch (cleanupError: any) {
      logger.error(`⚠️ Failed to cleanup temp directory:`, cleanupError.message);
    }
  }
}

/**
 * Validate parsed resume data to filter out placeholders
 * Based on OLD backend's validateAIResponse function
 */
export function validateParsedData(data: any): boolean {
  if (!data) return false;
  
  const placeholderValues = [
    'unknown candidate',
    'john doe',
    'jane doe',
    'candidate name',
    'your name',
    'n/a',
    'not provided',
    'not available',
    'none',
    'null',
    'undefined'
  ];
  
  const firstName = (data.firstName || '').toLowerCase().trim();
  const lastName = (data.lastName || '').toLowerCase().trim();
  const email = (data.email || '').toLowerCase().trim();
  
  // Check if name is a placeholder
  if (placeholderValues.includes(firstName) || placeholderValues.includes(lastName)) {
    logger.warn(`❌ Validation failed: Name is a placeholder (${firstName} ${lastName})`);
    return false;
  }
  
  // Check if name is empty
  if (!firstName || !lastName) {
    // If last name is missing, try to split firstName
    if (firstName && !lastName) {
      const nameParts = firstName.trim().split(' ');
      if (nameParts.length > 1) {
        logger.info(`✅ Validation passed (split name): ${nameParts.join(' ')} <${email}>`);
        return true;
      }
    }
    logger.warn(`❌ Validation failed: Missing name fields`);
    return false;
  }
  
  // Check if email is valid
  if (!email || !email.includes('@') || placeholderValues.some(p => email.includes(p))) {
    logger.warn(`❌ Validation failed: Invalid or placeholder email (${email})`);
    return false;
  }
  
  logger.info(`✅ Validation passed: ${firstName} ${lastName} <${email}>`);
  return true;
}

export default {
  parseResumeWithFallback,
  validateParsedData
};
