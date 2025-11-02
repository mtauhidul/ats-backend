/**
 * Firestore Services Index
 * Central export point for all Firestore services
 */

// Export service instances
export { userService } from "./user.service";
export { clientService } from "./client.service";
export { jobService } from "./job.service";
export { candidateService } from "./candidate.service";
export { applicationService } from "./application.service";
export { pipelineService } from "./pipeline.service";
export { interviewService } from "./interview.service";
export { emailService } from "./email.service";
export { emailAccountService } from "./emailAccount.service";
export { emailTemplateService } from "./emailTemplate.service";
export { messageService } from "./message.service";
export { notificationService } from "./notification.service";
export { teamMemberService } from "./teamMember.service";
export { activityLogService } from "./activityLog.service";
export { categoryService } from "./category.service";
export { tagService } from "./tag.service";
export { systemSettingsService } from "./systemSettings.service";

// Export types for convenience
export type { IUser } from "./user.service";
export type { IClient } from "./client.service";
export type { IJob } from "./job.service";
export type { ICandidate } from "./candidate.service";
export type { IApplication } from "./application.service";
export type { IPipeline, IPipelineStage } from "./pipeline.service";
export type { IInterview, IInterviewFeedback } from "./interview.service";
export type { IEmail } from "./email.service";
export type { IEmailAccount } from "./emailAccount.service";
export type { IEmailTemplate } from "./emailTemplate.service";
export type { IMessage } from "./message.service";
export type { INotification, NotificationType } from "./notification.service";
export type { ITeamMember } from "./teamMember.service";
export type { IActivityLog } from "./activityLog.service";
export type { ICategory } from "./category.service";
export type { ITag } from "./tag.service";
export type { ISystemSettings } from "./systemSettings.service";
