import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { ValidationError } from '../utils/errors';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to allow only specific file types
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new ValidationError('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'));
  }
};

// Create multer upload instance
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter,
});

// Middleware for single resume upload
export const uploadResume = upload.single('resume');

// Middleware for multiple resume uploads
export const uploadMultipleResumes = upload.array('resumes', 10); // Max 10 files
