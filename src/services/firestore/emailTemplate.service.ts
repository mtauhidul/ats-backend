import { FirestoreBaseService } from "./base.service";

export interface IEmailTemplate {
  id?: string;
  name: string;
  subject: string;
  body: string;
  type:
    | "interview"
    | "offer"
    | "rejection"
    | "follow_up"
    | "application_received"
    | "general";
  variables: string[];
  isDefault: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

class EmailTemplateService extends FirestoreBaseService<IEmailTemplate> {
  constructor() {
    super("emailTemplates");
  }

  /**
   * Find template by name
   */
  async findByName(name: string): Promise<IEmailTemplate | null> {
    const templates = await this.find([
      { field: "name", operator: "==", value: name },
    ]);
    return templates.length > 0 ? templates[0] : null;
  }

  /**
   * Find templates by type
   */
  async findByType(type: IEmailTemplate["type"]): Promise<IEmailTemplate[]> {
    return this.find([{ field: "type", operator: "==", value: type }]);
  }

  /**
   * Find active templates
   */
  async findActive(): Promise<IEmailTemplate[]> {
    return this.find([{ field: "isActive", operator: "==", value: true }]);
  }

  /**
   * Find active templates by type
   */
  async findActiveByType(
    type: IEmailTemplate["type"]
  ): Promise<IEmailTemplate[]> {
    return this.find([
      { field: "type", operator: "==", value: type },
      { field: "isActive", operator: "==", value: true },
    ]);
  }

  /**
   * Find default template by type
   */
  async findDefaultByType(
    type: IEmailTemplate["type"]
  ): Promise<IEmailTemplate | null> {
    const templates = await this.find([
      { field: "type", operator: "==", value: type },
      { field: "isDefault", operator: "==", value: true },
    ]);
    return templates.length > 0 ? templates[0] : null;
  }

  /**
   * Set template as default (ensures only one default per type)
   */
  async setAsDefault(
    id: string,
    type: IEmailTemplate["type"]
  ): Promise<void> {
    // First, unset any existing default for this type
    const existingDefaults = await this.find([
      { field: "type", operator: "==", value: type },
      { field: "isDefault", operator: "==", value: true },
    ]);

    // Use batch update to ensure atomicity
    const updates: Promise<void>[] = [];

    // Unset existing defaults
    for (const template of existingDefaults) {
      if (template.id && template.id !== id) {
        updates.push(
          this.update(template.id, {
            isDefault: false,
            updatedAt: new Date(),
          })
        );
      }
    }

    // Set new default
    updates.push(
      this.update(id, {
        isDefault: true,
        updatedAt: new Date(),
      })
    );

    await Promise.all(updates);
  }

  /**
   * Activate template
   */
  async activate(id: string): Promise<void> {
    await this.update(id, {
      isActive: true,
      updatedAt: new Date(),
    });
  }

  /**
   * Deactivate template
   */
  async deactivate(id: string): Promise<void> {
    await this.update(id, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Clone template with new name
   */
  async clone(id: string, newName: string, createdBy?: string): Promise<string> {
    const originalTemplate = await this.findById(id);
    if (!originalTemplate) {
      throw new Error("Template not found");
    }

    const clonedTemplate: Omit<IEmailTemplate, "id"> = {
      name: newName,
      subject: originalTemplate.subject,
      body: originalTemplate.body,
      type: originalTemplate.type,
      variables: [...originalTemplate.variables],
      isDefault: false, // Cloned templates are never default
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.create(clonedTemplate);
  }

  /**
   * Replace variables in template
   * Supports both {{variable}} and [Variable Name] formats
   */
  replaceVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;
    
    // Define mapping between camelCase keys and [Display Name] formats
    const displayNameMap: Record<string, string[]> = {
      'companyName': ['Company Name', 'CompanyName'],
      'candidateName': ['Candidate Name', 'CandidateName'],
      'jobTitle': ['Job Title', 'JobTitle'],
      'interviewDate': ['Interview Date', 'InterviewDate'],
      'interviewTime': ['Interview Time', 'InterviewTime'],
      'interviewLocation': ['Interview Location', 'InterviewLocation'],
      'interviewDuration': ['Interview Duration', 'InterviewDuration', 'Duration'],
      'recruiterName': ['Recruiter Name', 'RecruiterName'],
      'startDate': ['Start Date', 'StartDate'],
      'salary': ['Salary'],
      'benefits': ['Benefits'],
      'responseDeadline': ['Response Deadline', 'ResponseDeadline'],
      'screeningDeadline': ['Screening Deadline', 'ScreeningDeadline'],
      'customMessage': ['Custom Message', 'CustomMessage'],
    };
    
    Object.entries(variables).forEach(([key, value]) => {
      // Replace {{key}} format
      const curlyRegex = new RegExp(`{{${key}}}`, "g");
      result = result.replace(curlyRegex, value || "");
      
      // Replace [Display Name] format
      const displayNames = displayNameMap[key] || [key];
      displayNames.forEach(displayName => {
        const bracketRegex = new RegExp(`\\[${displayName}\\]`, "g");
        result = result.replace(bracketRegex, value || "");
      });
    });
    
    return result;
  }

  /**
   * Render template with variables
   */
  async render(
    templateId: string,
    variables: Record<string, string>
  ): Promise<{ subject: string; body: string }> {
    const template = await this.findById(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    return {
      subject: this.replaceVariables(template.subject, variables),
      body: this.replaceVariables(template.body, variables),
    };
  }

  /**
   * Render template by type with variables
   */
  async renderByType(
    type: IEmailTemplate["type"],
    variables: Record<string, string>
  ): Promise<{ subject: string; body: string } | null> {
    const template = await this.findDefaultByType(type);
    if (!template) {
      return null;
    }

    return {
      subject: this.replaceVariables(template.subject, variables),
      body: this.replaceVariables(template.body, variables),
    };
  }

  /**
   * Extract variables from template text
   */
  extractVariables(text: string): string[] {
    const regex = /{{(\w+)}}/g;
    const matches = text.matchAll(regex);
    const variables = new Set<string>();

    for (const match of matches) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Update template and auto-detect variables
   */
  async updateWithAutoVariables(
    id: string,
    updates: Partial<Pick<IEmailTemplate, "subject" | "body">>
  ): Promise<void> {
    const template = await this.findById(id);
    if (!template) {
      throw new Error("Template not found");
    }

    const newSubject = updates.subject || template.subject;
    const newBody = updates.body || template.body;

    // Extract variables from both subject and body
    const subjectVars = this.extractVariables(newSubject);
    const bodyVars = this.extractVariables(newBody);
    const allVariables = Array.from(new Set([...subjectVars, ...bodyVars]));

    await this.update(id, {
      ...updates,
      variables: allVariables,
      updatedAt: new Date(),
    });
  }

  /**
   * Check if template name exists
   */
  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    const templates = await this.find([
      { field: "name", operator: "==", value: name },
    ]);

    if (excludeId) {
      return templates.some((t) => t.id !== excludeId);
    }

    return templates.length > 0;
  }

  /**
   * Subscribe to active templates
   */
  subscribeToActiveTemplates(
    callback: (templates: IEmailTemplate[]) => void,
    options?: { limit?: number }
  ): () => void {
    return this.subscribeToCollection(
      [{ field: "isActive", operator: "==", value: true }],
      callback,
      options
    );
  }
}

export const emailTemplateService = new EmailTemplateService();
