import { Request, Response } from 'express';
import { EmailTemplate } from '../models/EmailTemplate';

/**
 * Extract variables from template body
 * Finds all {{variableName}} patterns
 */
const extractVariables = (text: string): string[] => {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
};

/**
 * Get all email templates
 * Supports filtering by type, isDefault, isActive
 * GET /api/email-templates?type=interview&isDefault=true&isActive=true
 */
export const getEmailTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, isDefault, isActive } = req.query;
    
    const filter: any = {};
    
    if (type) {
      filter.type = type;
    }
    
    if (isDefault !== undefined) {
      filter.isDefault = isDefault === 'true';
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    } else {
      // By default, only show active templates
      filter.isActive = true;
    }
    
    const templates = await EmailTemplate.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error: any) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email templates',
      error: error.message
    });
  }
};

/**
 * Get email template by ID
 * GET /api/email-templates/:id
 */
export const getEmailTemplateById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const template = await EmailTemplate.findById(id)
      .populate('createdBy', 'firstName lastName email');
    
    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Email template not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: template
    });
  } catch (error: any) {
    console.error('Error fetching email template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email template',
      error: error.message
    });
  }
};

/**
 * Get templates by type
 * GET /api/email-templates/type/:type
 */
export const getTemplatesByType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    
    const templates = await EmailTemplate.find({
      type,
      isActive: true
    })
      .populate('createdBy', 'firstName lastName email')
      .sort({ isDefault: -1, createdAt: -1 });
    
    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error: any) {
    console.error('Error fetching templates by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates by type',
      error: error.message
    });
  }
};

/**
 * Create new email template
 * POST /api/email-templates
 */
export const createEmailTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, subject, body, type, isDefault = false } = req.body;
    
    // Validate required fields
    if (!name || !subject || !body || !type) {
      res.status(400).json({
        success: false,
        message: 'Name, subject, body, and type are required'
      });
      return;
    }
    
    // Extract variables from body
    const variables = extractVariables(body);
    
    // Create template
    const template = new EmailTemplate({
      name,
      subject,
      body,
      type,
      variables,
      isDefault,
      isActive: true,
      createdBy: req.user?._id
    });
    
    await template.save();
    
    // Populate createdBy for response
    await template.populate('createdBy', 'firstName lastName email');
    
    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      data: template
    });
  } catch (error: any) {
    console.error('Error creating email template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create email template',
      error: error.message
    });
  }
};

/**
 * Update email template
 * PUT /api/email-templates/:id
 */
export const updateEmailTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, subject, body, type, isDefault, isActive } = req.body;
    
    const template = await EmailTemplate.findById(id);
    
    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Email template not found'
      });
      return;
    }
    
    // Update fields
    if (name !== undefined) template.name = name;
    if (subject !== undefined) template.subject = subject;
    if (type !== undefined) template.type = type;
    if (isDefault !== undefined) template.isDefault = isDefault;
    if (isActive !== undefined) template.isActive = isActive;
    
    if (body !== undefined) {
      template.body = body;
      // Re-extract variables when body changes
      template.variables = extractVariables(body);
    }
    
    await template.save();
    
    // Populate createdBy for response
    await template.populate('createdBy', 'firstName lastName email');
    
    res.json({
      success: true,
      message: 'Email template updated successfully',
      data: template
    });
  } catch (error: any) {
    console.error('Error updating email template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email template',
      error: error.message
    });
  }
};

/**
 * Delete email template (soft delete)
 * DELETE /api/email-templates/:id
 */
export const deleteEmailTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const template = await EmailTemplate.findById(id);
    
    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Email template not found'
      });
      return;
    }
    
    // Soft delete - set isActive to false
    template.isActive = false;
    await template.save();
    
    res.json({
      success: true,
      message: 'Email template deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting email template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete email template',
      error: error.message
    });
  }
};

/**
 * Duplicate email template
 * POST /api/email-templates/:id/duplicate
 */
export const duplicateEmailTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const originalTemplate = await EmailTemplate.findById(id);
    
    if (!originalTemplate) {
      res.status(404).json({
        success: false,
        message: 'Email template not found'
      });
      return;
    }
    
    // Create duplicate with modified name
    const duplicate = new EmailTemplate({
      name: `${originalTemplate.name} (Copy)`,
      subject: originalTemplate.subject,
      body: originalTemplate.body,
      type: originalTemplate.type,
      variables: originalTemplate.variables,
      isDefault: false, // Duplicates are never default
      isActive: true,
      createdBy: req.user?._id
    });
    
    await duplicate.save();
    
    // Populate createdBy for response
    await duplicate.populate('createdBy', 'firstName lastName email');
    
    res.status(201).json({
      success: true,
      message: 'Email template duplicated successfully',
      data: duplicate
    });
  } catch (error: any) {
    console.error('Error duplicating email template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate email template',
      error: error.message
    });
  }
};

/**
 * Get default templates (for seeding/initialization)
 * GET /api/email-templates/defaults
 */
export const getDefaultTemplates = async (_req: Request, res: Response): Promise<void> => {
  try {
    const templates = await EmailTemplate.find({
      isDefault: true,
      isActive: true
    }).sort({ type: 1 });
    
    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error: any) {
    console.error('Error fetching default templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch default templates',
      error: error.message
    });
  }
};
