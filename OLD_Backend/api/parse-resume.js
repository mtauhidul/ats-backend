// server/api/parse-resume.js

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { OpenAI } = require("openai");
const cors = require("cors");
const util = require("util");
const readFile = util.promisify(fs.readFile);
const { uploadFileToStorage } = require("../services/firebaseService");
const {
  validateFile,
  getUploadConfig,
} = require("../services/fileUploadService");
const logger = require("../utils/logger");

// Configure multer for file upload - using memory storage for Firebase upload
const storage = multer.memoryStorage();

// Get secure upload configuration
const uploadConfig = getUploadConfig();

const upload = multer({
  storage: storage,
  fileFilter: uploadConfig.fileFilter,
  limits: uploadConfig.limits,
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Import enhanced AI service for improved accuracy
const EnhancedAIService = require("../services/enhancedAIService");
const enhancedAI = new EnhancedAIService();

/**
 * Validate AI response to prevent placeholder values like "Unknown Candidate"
 */
const validateAIResponse = (parsed) => {
  const placeholders = [
    "unknown candidate",
    "candidate name",
    "your name", 
    "name not found",
    "email not found",
    "phone not found",
    "[name]",
    "john doe",
    "jane doe",
    "sample name",
    "example name",
  ];

  const validated = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      const lowerValue = value.toLowerCase().trim();
      
      // Special handling for different fields
      if (key === 'experience' || key === 'education') {
        // For experience and education, be less restrictive
        // Only check for specific placeholder patterns, not generic words
        const isPlaceholder = placeholders.some((placeholder) => 
          lowerValue === placeholder || lowerValue.includes('candidate') || lowerValue.includes('unknown')
        );
        
        if (isPlaceholder || lowerValue.length === 0) {
          validated[key] = null;
          logger.warn(
            `Detected placeholder value for ${key}: "${value}" - setting to null`
          );
        } else {
          validated[key] = value;
        }
      } else {
        // For other fields, check if it's a placeholder
        if (
          placeholders.some((placeholder) => lowerValue.includes(placeholder)) ||
          lowerValue.length < 2
        ) {
          validated[key] = null;
          logger.warn(
            `Detected placeholder value for ${key}: "${value}" - setting to null`
          );
        } else {
          validated[key] = value;
        }
      }
    } else if (Array.isArray(value)) {
      // Validate array items for placeholders
      validated[key] = value.filter((item) => {
        if (typeof item === "string") {
          const lowerItem = item.toLowerCase().trim();
          return (
            !placeholders.some((placeholder) =>
              lowerItem.includes(placeholder)
            ) && lowerItem.length >= 2
          );
        }
        return true;
      });
    } else {
      validated[key] = value;
    }
  }

  return validated;
};

// Custom render function that's more tolerant of errors
function renderPage(pageData) {
  let renderOptions = {
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  };

  return pageData
    .getTextContent(renderOptions)
    .then(function (textContent) {
      let text = "";
      let lastY = -1;
      let lastX = -1;

      for (let item of textContent.items) {
        if (
          lastY !== item.transform[5] ||
          Math.abs(lastX - item.transform[4]) > 10
        ) {
          text += "\n";
        } else if (lastX !== item.transform[4]) {
          text += " ";
        }

        text += item.str;
        lastY = item.transform[5];
        lastX = item.transform[4] + item.width;
      }

      return text;
    })
    .catch(function (err) {
      // Even if there's an error, try to continue with other pages
      console.warn("Error in page rendering, continuing:", err);
      return "";
    });
}

// Extract text from PDF using pdf-parse
async function extractTextWithPdfParse(filePath) {
  try {
    const pdfParse = require("pdf-parse");
    const dataBuffer = fs.readFileSync(filePath);

    // Try with default options first
    try {
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (pdfError) {
      console.warn(
        "Initial PDF parsing failed, trying with fallback options:",
        pdfError.message
      );

      // If the error is related to XRef or other format issues, try with more tolerant options
      if (
        pdfError.message.includes("XRef") ||
        pdfError.message.includes("cross-reference") ||
        pdfError.message.includes("FormatError")
      ) {
        try {
          // Try again with more forgiving options
          const options = {
            pagerender: renderPage,
            max: 0, // No page limit
            version: "v2.0.550", // Use a specific version of pdf.js
          };

          const data = await pdfParse(dataBuffer, options);
          if (data.text && data.text.length > 0) {
            return data.text;
          } else {
            throw new Error("Parsed PDF but no text was extracted");
          }
        } catch (fallbackError) {
          console.error("Fallback PDF parsing also failed:", fallbackError);
          throw fallbackError;
        }
      } else {
        // Not an XRef error, rethrow the original error
        throw pdfError;
      }
    }
  } catch (error) {
    console.error("Error extracting text with pdf-parse:", error);
    throw error;
  }
}

// Extract text from PDF using pdf2json
async function extractTextWithPdf2json(filePath) {
  return new Promise((resolve, reject) => {
    const PDFParser = require("pdf2json");
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData) => {
      reject(new Error(errData.parserError));
    });

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        // Convert PDF data to text
        let text = "";
        for (let i = 0; i < pdfData.Pages.length; i++) {
          const page = pdfData.Pages[i];
          for (let j = 0; j < page.Texts.length; j++) {
            const textItem = page.Texts[j];
            for (let k = 0; k < textItem.R.length; k++) {
              text += decodeURIComponent(textItem.R[k].T) + " ";
            }
          }
          text += "\n\n"; // Add page breaks
        }
        resolve(text);
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.loadPDF(filePath);
  });
}

// Extract text from PDF using pdfjs-dist with dynamic import
async function extractTextWithPdfJs(filePath) {
  try {
    // Use dynamic import for ESM compatibility
    const pdfjsLib = await import("pdfjs-dist");

    // Read the PDF file into a buffer
    const dataBuffer = fs.readFileSync(filePath);
    const data = new Uint8Array(dataBuffer);

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDocument = await loadingTask.promise;
    let extractedText = "";

    // Process each page
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Extract text from page
      const pageText = textContent.items.map((item) => item.str).join(" ");

      extractedText += pageText + "\n\n";
    }

    return extractedText;
  } catch (error) {
    console.error("Error extracting text with pdfjs-dist:", error);
    throw error;
  }
}

// Main PDF text extraction function with multiple fallbacks
async function extractTextFromPDF(filePath) {
  let errors = [];

  // Try with pdf-parse first
  try {
    const text = await extractTextWithPdfParse(filePath);
    if (text && text.trim().length > 0) {
      console.log("Successfully extracted text with pdf-parse");
      return text;
    }
  } catch (pdfParseError) {
    console.warn("pdf-parse extraction failed:", pdfParseError.message);
    errors.push(`pdf-parse: ${pdfParseError.message}`);
  }

  // Try with pdf2json second
  try {
    const text = await extractTextWithPdf2json(filePath);
    if (text && text.trim().length > 0) {
      console.log("Successfully extracted text with pdf2json");
      return text;
    }
  } catch (pdf2jsonError) {
    console.warn("pdf2json extraction failed:", pdf2jsonError.message);
    errors.push(`pdf2json: ${pdf2jsonError.message}`);
  }

  // Try with pdfjs-dist last
  try {
    const text = await extractTextWithPdfJs(filePath);
    if (text && text.trim().length > 0) {
      console.log("Successfully extracted text with pdfjs-dist");
      return text;
    }
  } catch (pdfjsError) {
    console.warn("pdfjs-dist extraction failed:", pdfjsError.message);
    errors.push(`pdfjs-dist: ${pdfjsError.message}`);
  }

  // If we get here, all methods failed
  throw new Error(
    `Failed to extract text from PDF after trying multiple libraries. Errors: ${errors.join(
      "; "
    )}`
  );
}

// Extract text from DOC/DOCX using mammoth
async function extractTextFromDOCX(filePath) {
  try {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error("Error extracting text from DOCX:", error);
    throw new Error("Failed to extract text from DOC/DOCX");
  }
}

// Buffer-based extraction functions for Firebase Storage workflow

// Extract text from PDF buffer using pdf-parse
async function extractTextFromPDFBuffer(buffer) {
  let errors = [];

  // Try with pdf-parse first
  try {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    if (data.text && data.text.trim().length > 0) {
      console.log("Successfully extracted text from PDF buffer with pdf-parse");
      return data.text;
    }
  } catch (pdfParseError) {
    console.warn("pdf-parse buffer extraction failed:", pdfParseError.message);
    errors.push(`pdf-parse: ${pdfParseError.message}`);
  }

  // If pdf-parse fails, we could add other buffer-based methods here
  // For now, we'll throw an error if pdf-parse fails
  throw new Error(
    `Failed to extract text from PDF buffer. Errors: ${errors.join("; ")}`
  );
}

// Extract text from DOC/DOCX buffer using mammoth
async function extractTextFromDOCXBuffer(buffer) {
  try {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer: buffer });
    return result.value;
  } catch (error) {
    console.error("Error extracting text from DOCX buffer:", error);
    throw new Error("Failed to extract text from DOC/DOCX buffer");
  }
}

// Parse resume text using Enhanced AI Service (with fallback to original)
const parseResumeWithOpenAI = async (text, fileName) => {
  try {
    logger.info(`Starting resume parsing with enhanced AI service`, {
      fileName,
    });

    // STRICT AI PARSING - NO FALLBACKS
    logger.info(`Starting high-accuracy AI parsing for ${fileName}`);
    
    try {
      const enhancedResult = await enhancedAI.parseResume(text, fileName);
      
      // Strict validation - no fallbacks allowed
      if (!enhancedResult || !enhancedResult.name || !Array.isArray(enhancedResult.skills) || enhancedResult.skills.length < 3) {
        throw new Error(`PARSING QUALITY INSUFFICIENT: Missing critical data fields (name, skills, or experience)`);
      }
      
      logger.info(`High-quality AI parsing completed successfully for ${fileName}`, {
        extractedFields: Object.keys(enhancedResult).length,
        hasName: !!enhancedResult.name,
        skillsCount: enhancedResult.skills?.length || 0,
        hasExperience: !!enhancedResult.experience
      });
      
      return enhancedResult;
      
    } catch (enhancedError) {
      logger.error(`AI parsing failed completely - NO FALLBACK`, {
        fileName,
        error: enhancedError.message,
        critical_failure: true
      });
      throw new Error(`Resume parsing failed: ${enhancedError.message}`);
    }
  } catch (error) {
    console.error("Error parsing resume with AI:", error);
    throw new Error(
      `Failed to parse resume with AI: ${error.message || "Unknown error"}`
    );
  }
};

// Validation and enhancement function for parsed resume data
const validateAndEnhanceResumeData = (parsedResume, originalText, fileName) => {
  // CRITICAL: Prevent "Unknown Candidate" and placeholder responses
  parsedResume = validateAIResponse(parsedResume);

  // Ensure education is always a string
  if (parsedResume.education && typeof parsedResume.education !== "string") {
    if (Array.isArray(parsedResume.education)) {
      parsedResume.education = parsedResume.education
        .map((edu) =>
          typeof edu === "object" ? JSON.stringify(edu) : String(edu)
        )
        .join("\n");
    } else if (typeof parsedResume.education === "object") {
      parsedResume.education = JSON.stringify(parsedResume.education);
    } else {
      parsedResume.education = String(parsedResume.education);
    }
  }

  // Validate and clean skills array
  if (parsedResume.skills && Array.isArray(parsedResume.skills)) {
    parsedResume.skills = parsedResume.skills
      .filter(
        (skill) => skill && typeof skill === "string" && skill.trim().length > 0
      )
      .map((skill) => skill.trim())
      .filter((skill, index, array) => array.indexOf(skill) === index); // Remove duplicates
  }

  // Validate email format
  if (
    parsedResume.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsedResume.email)
  ) {
    logger.warn(`Invalid email format detected: ${parsedResume.email}`, {
      fileName,
    });
  }

  // Add enhanced metadata
  parsedResume.originalFilename = fileName;
  // Always ensure resumeText contains the full extracted text content
  parsedResume.resumeText = originalText;
  parsedResume.parsingTimestamp = new Date().toISOString();
  parsedResume.parsingMethod = "enhanced_ai_v2";

  // Add extracted numeric experience if possible
  if (parsedResume.experience && typeof parsedResume.experience === "string") {
    const numericMatch = parsedResume.experience.match(
      /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i
    );
    if (numericMatch) {
      parsedResume.experienceYears = parseFloat(numericMatch[1]);
    }
  }

  return parsedResume;
};

// Import scoring utilities
const { scoreResume } = require("../utils/resumeScoring");
const { getJobData } = require("../services/resumeScoringService");

// Enable CORS for the router
router.use(cors());

// Resume parsing endpoint - identical to email attachment parsing
router.post("/parse", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const fileExtension = path.extname(originalName).toLowerCase();

    // Extract text based on file type
    let text;
    try {
      if (fileExtension === ".pdf") {
        text = await extractTextFromPDFBuffer(fileBuffer);

        // Check if text was successfully extracted
        if (!text || text.trim().length === 0) {
          throw new Error(
            "PDF parsed but no text could be extracted. The PDF might be image-based or secured."
          );
        }
      } else if (fileExtension === ".doc" || fileExtension === ".docx") {
        text = await extractTextFromDOCXBuffer(fileBuffer);
      } else if (fileExtension === ".txt") {
        // For text files, convert buffer to string
        text = fileBuffer.toString("utf8");
      } else {
        return res
          .status(400)
          .json({ success: false, error: "Unsupported file type" });
      }
    } catch (extractionError) {
      console.error("Text extraction error:", extractionError);
      return res.status(422).json({
        success: false,
        error: `Failed to extract text from the ${fileExtension} file: ${extractionError.message}`,
        details: extractionError.details || extractionError.message,
        suggestion:
          fileExtension === ".pdf"
            ? "The PDF may be corrupted, password-protected, or contains only images. Try converting it to text first or use a different file."
            : "The document may be corrupted or has an unsupported format. Try saving as a different format.",
      });
    }

    // Parse the resume text with OpenAI
    try {
      const parsedResume = await parseResumeWithOpenAI(text, originalName);

      // Add source information (same as email attachment)
      parsedResume.source = "manual_import";
      parsedResume.importMethod = "ai_parser";

      // Upload file to Firebase Storage after successful parsing (same as email attachment)
      let resumeFileURL = null;
      try {
        logger.info(
          `Uploading manual import file to Firebase Storage: ${originalName}`
        );
        resumeFileURL = await uploadFileToStorage(
          fileBuffer,
          originalName,
          mimeType,
          "resumes"
        );
        logger.info(
          `Manual import file uploaded successfully: ${resumeFileURL}`
        );
      } catch (uploadError) {
        logger.error(
          `Failed to upload manual import file to Firebase Storage: ${uploadError.message}`
        );
        // Continue processing even if upload fails
        resumeFileURL = null;
      }

      // Check if scoring parameters are provided
      const { jobId, jobTitle } = req.body;
      let scoreResult = null;
      let jobData = null;

      if (jobId || jobTitle) {
        try {
          // If jobId is provided, get job data from the system
          if (jobId) {
            jobData = await getJobData(jobId);
            if (jobData) {
              logger.info(`Retrieved job data for scoring: ${jobData.title}`, { jobId });
            } else {
              logger.warn(`Job not found with ID: ${jobId}`);
            }
          }
          
          // If no job data from jobId but jobTitle is provided, create mock job data
          if (!jobData && jobTitle) {
            jobData = {
              id: jobId || 'manual-scoring',
              title: jobTitle,
              requiredSkills: [], // Will be populated by scoring algorithm
              preferredSkills: [],
              experience: null,
              education: null,
              description: `Manual scoring for ${jobTitle} position`
            };
            logger.info(`Using manual job title for scoring: ${jobTitle}`);
          }

          // Score the resume against the job if we have job data
          if (jobData) {
            scoreResult = await scoreResume(parsedResume, jobData);
            logger.info(`Resume scoring completed`, {
              candidateName: parsedResume.name,
              jobTitle: jobData.title,
              finalScore: scoreResult.finalScore
            });
          }
        } catch (scoringError) {
          logger.warn(
            `Scoring failed but continuing with parse-only response`,
            {
              jobId,
              jobTitle,
              error: scoringError.message
            }
          );
          // Continue with parse-only response if scoring fails
        }
      }

      // Prepare base response data
      const responseData = {
        ...parsedResume,
        resumeFileURL: resumeFileURL,
        originalFilename: originalName,
        fileType: mimeType,
        fileSize: req.file.size,
      };

      // Return response based on whether scoring was performed
      if (scoreResult && jobData) {
        // Return combined parsing and scoring response
        return res.json({
          success: true,
          data: responseData,
          score: {
            finalScore: scoreResult.finalScore,
            breakdown: {
              skillsMatch: scoreResult.componentScores.skillScore,
              experienceMatch: scoreResult.componentScores.experienceScore,
              educationMatch: scoreResult.componentScores.educationScore,
            },
            matchedSkills: scoreResult.matchedSkills,
            missingSkills: scoreResult.missingSkills,
            feedback: scoreResult.feedback,
          },
          scoring: {
            finalScore: scoreResult.finalScore,
            jobId: jobId,
            jobTitle: jobData.title,
            componentScores: scoreResult.componentScores,
            scoredAt: new Date().toISOString(),
          },
        });
      } else {
        // Return parse-only response (same as email attachment)
        return res.json({
          success: true,
          data: responseData,
        });
      }
    } catch (parsingError) {
      console.error("Resume parsing error:", parsingError);
      return res.status(500).json({
        success: false,
        error: "Failed to parse resume content",
        details: parsingError.message,
        suggestion: "Try a different resume file or format.",
      });
    }
  } catch (error) {
    // Pass to error handler with more details
    error.statusCode = error.statusCode || 500;
    error.detail = `Error processing ${
      req.file ? req.file.originalname : "file"
    }: ${error.message}`;
    next(error);
  }
});

// Email attachment parsing endpoint - for PDF, DOC/DOCX, and TXT
router.post(
  "/parse-attachment",
  upload.single("attachment"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "No attachment uploaded" });
      }

      const fileBuffer = req.file.buffer;
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const fileExtension = path.extname(originalName).toLowerCase();

      // Extract text based on file type
      let text;
      try {
        if (fileExtension === ".pdf") {
          text = await extractTextFromPDFBuffer(fileBuffer);

          // Check if text was successfully extracted
          if (!text || text.trim().length === 0) {
            throw new Error(
              "PDF parsed but no text could be extracted. The PDF might be image-based or secured."
            );
          }
        } else if (fileExtension === ".doc" || fileExtension === ".docx") {
          text = await extractTextFromDOCXBuffer(fileBuffer);
        } else if (fileExtension === ".txt") {
          // For text files, convert buffer to string
          text = fileBuffer.toString("utf8");
        } else {
          return res
            .status(400)
            .json({ success: false, error: "Unsupported file type" });
        }
      } catch (extractionError) {
        console.error("Text extraction error:", extractionError);
        return res.status(422).json({
          success: false,
          error: `Failed to extract text from the ${fileExtension} file: ${extractionError.message}`,
          details: extractionError.details || extractionError.message,
          suggestion:
            fileExtension === ".pdf"
              ? "The PDF may be corrupted, password-protected, or contains only images. Try converting it to text first or use a different file."
              : "The document may be corrupted or has an unsupported format. Try saving as a different format.",
        });
      }

      // Parse the resume text with OpenAI
      try {
        const parsedResume = await parseResumeWithOpenAI(text, originalName);

        // Add source information
        parsedResume.source = "email_attachment";
        parsedResume.importMethod = "ai_parser";

        // Upload file to Firebase Storage after successful parsing
        let resumeFileURL = null;
        try {
          logger.info(
            `Uploading attachment file to Firebase Storage: ${originalName}`
          );
          resumeFileURL = await uploadFileToStorage(
            fileBuffer,
            originalName,
            mimeType,
            "resumes"
          );
          logger.info(
            `Attachment file uploaded successfully: ${resumeFileURL}`
          );
        } catch (uploadError) {
          logger.error(
            `Failed to upload attachment file to Firebase Storage: ${uploadError.message}`
          );
          // Continue processing even if upload fails
          resumeFileURL = null;
        }

        // Return the parsed resume data with file information
        return res.json({
          success: true,
          data: {
            ...parsedResume,
            resumeFileURL: resumeFileURL,
            originalFilename: originalName,
            fileType: mimeType,
            fileSize: req.file.size,
          },
        });
      } catch (parsingError) {
        console.error("Resume parsing error:", parsingError);
        return res.status(500).json({
          success: false,
          error: "Failed to parse resume content",
          details: parsingError.message,
          suggestion: "Try a different resume file or format.",
        });
      }
    } catch (error) {
      // Pass to error handler with more details
      error.statusCode = error.statusCode || 500;
      error.detail = `Error processing ${
        req.file ? req.file.originalname : "file"
      }: ${error.message}`;
      next(error);
    }
  }
);

// Combined parse and score endpoint
router.post(
  "/parse-and-score",
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "No file uploaded" });
      }

      const { jobId } = req.body;
      if (!jobId) {
        return res
          .status(400)
          .json({ success: false, error: "Job ID is required for scoring" });
      }

      const fileBuffer = req.file.buffer;
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const fileExtension = path.extname(originalName).toLowerCase();

      // Extract text based on file type
      let text;
      try {
        if (fileExtension === ".pdf") {
          text = await extractTextFromPDFBuffer(fileBuffer);

          // Check if text was successfully extracted
          if (!text || text.trim().length === 0) {
            throw new Error(
              "PDF parsed but no text could be extracted. The PDF might be image-based or secured."
            );
          }
        } else if (fileExtension === ".doc" || fileExtension === ".docx") {
          text = await extractTextFromDOCXBuffer(fileBuffer);
        } else {
          // This should not happen due to fileFilter, but just in case
          return res
            .status(400)
            .json({ success: false, error: "Unsupported file type" });
        }
      } catch (extractionError) {
        console.error("Text extraction error:", extractionError);
        return res.status(422).json({
          success: false,
          error: `Failed to extract text from the ${fileExtension} file: ${extractionError.message}`,
          details: extractionError.details || extractionError.message,
          suggestion:
            fileExtension === ".pdf"
              ? "The PDF may be corrupted, password-protected, or contains only images. Try converting it to text first or use a different file."
              : "The document may be corrupted or has an unsupported format. Try saving as a different format.",
        });
      }

      // Parse the resume text with OpenAI
      let parsedResume;
      try {
        parsedResume = await parseResumeWithOpenAI(text, originalName);
      } catch (parsingError) {
        console.error("Resume parsing error:", parsingError);
        return res.status(500).json({
          success: false,
          error: "Failed to parse resume content",
          details: parsingError.message,
          suggestion: "Try a different resume file or format.",
        });
      }

      // Get job data for scoring
      let jobData;
      try {
        jobData = await getJobData(jobId);
        if (!jobData) {
          return res.status(404).json({
            success: false,
            error: `Job with ID ${jobId} not found`,
          });
        }
      } catch (jobError) {
        console.error("Job data retrieval error:", jobError);
        return res.status(500).json({
          success: false,
          error: "Failed to retrieve job data",
          details: jobError.message,
        });
      }

      // Score the resume against the job
      let scoreResult;
      try {
        scoreResult = await scoreResume(parsedResume, jobData);
      } catch (scoringError) {
        console.error("Resume scoring error:", scoringError);
        return res.status(500).json({
          success: false,
          error: "Failed to score resume",
          details: scoringError.message,
        });
      }

      // Upload file to Firebase Storage after successful parsing and scoring
      let resumeFileURL = null;
      try {
        logger.info(
          `Uploading resume file to Firebase Storage: ${originalName}`
        );
        resumeFileURL = await uploadFileToStorage(
          fileBuffer,
          originalName,
          mimeType,
          "resumes"
        );
        logger.info(`Resume file uploaded successfully: ${resumeFileURL}`);
      } catch (uploadError) {
        logger.error(
          `Failed to upload resume file to Firebase Storage: ${uploadError.message}`
        );
        // Continue processing even if upload fails
        resumeFileURL = null;
      }

      // Return the combined response in the expected format
      return res.json({
        success: true,
        candidate: {
          ...parsedResume,
          resumeFileURL: resumeFileURL,
          originalFilename: originalName,
          fileType: mimeType,
          fileSize: req.file.size,
        },
        score: {
          finalScore: scoreResult.finalScore,
          breakdown: {
            skillsMatch: scoreResult.componentScores.skillScore,
            experienceMatch: scoreResult.componentScores.experienceScore,
            educationMatch: scoreResult.componentScores.educationScore,
          },
          matchedSkills: scoreResult.matchedSkills,
          missingSkills: scoreResult.missingSkills,
          feedback: scoreResult.feedback,
        },
        resumeScoringDetails: {
          finalScore: scoreResult.finalScore,
          jobId: jobId,
          jobTitle: jobData.title,
          componentScores: scoreResult.componentScores,
          scoredAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Pass to error handler with more details
      error.statusCode = error.statusCode || 500;
      error.detail = `Error processing ${
        req.file ? req.file.originalname : "file"
      }: ${error.message}`;
      next(error);
    }
  }
);

// Confirm import endpoint - uploads file to Firebase Storage after user confirmation
router.post("/confirm-import", async (req, res, next) => {
  try {
    const { fileData, originalFilename, fileType, candidateData } = req.body;

    if (!fileData || !originalFilename || !fileType || !candidateData) {
      return res.status(400).json({
        success: false,
        error: "Missing required data for import confirmation",
      });
    }

    try {
      // Convert base64 back to buffer for upload
      const fileBuffer = Buffer.from(fileData, "base64");

      logger.info(
        `Confirming import and uploading resume file to Firebase Storage: ${originalFilename}`
      );

      // Upload file to Firebase Storage
      const resumeFileURL = await uploadFileToStorage(
        fileBuffer,
        originalFilename,
        fileType,
        "resumes"
      );

      logger.info(
        `Resume file uploaded successfully after confirmation: ${resumeFileURL}`
      );

      // Return the confirmed data with Firebase Storage URL
      return res.json({
        success: true,
        data: {
          ...candidateData,
          resumeFileURL: resumeFileURL,
          originalFilename: originalFilename,
          fileType: fileType,
          fileSize: fileBuffer.length,
          confirmedAt: new Date().toISOString(),
        },
      });
    } catch (uploadError) {
      logger.error(
        `Failed to upload resume file to Firebase Storage during confirmation: ${uploadError.message}`
      );
      return res.status(500).json({
        success: false,
        error: "Failed to upload resume file",
        details: uploadError.message,
      });
    }
  } catch (error) {
    logger.error("Error in confirm-import:", error);
    error.statusCode = error.statusCode || 500;
    error.detail = `Error confirming import: ${error.message}`;
    next(error);
  }
});

module.exports = router;
