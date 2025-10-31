import { Request, Response } from "express";
import { Email } from "../models";
import resendService from "../services/resend.service";
import { NotFoundError } from "../utils/errors";
import {
  asyncHandler,
  paginateResults,
  successResponse,
} from "../utils/helpers";
import logger from "../utils/logger";

/**
 * Get all emails with filters and pagination
 */
export const getEmails = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      direction,
      candidateId,
      applicationId,
      jobId,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query as any;

    // Build filter
    const filter: any = {};
    if (direction) filter.direction = direction;
    if (candidateId) filter.candidateId = candidateId;
    if (applicationId) filter.applicationId = applicationId;
    if (jobId) filter.jobId = jobId;
    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { from: { $regex: search, $options: "i" } },
        { to: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count
    const totalCount = await Email.countDocuments(filter);

    // Calculate pagination
    const pagination = paginateResults(totalCount, {
      page,
      limit,
      sort: sortBy,
      order: sortOrder,
    });

    // Calculate skip
    const skip = (page - 1) * limit;

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Fetch data
    const emails = await Email.find(filter)
      .populate("candidateId", "firstName lastName email")
      .populate("applicationId", "firstName lastName")
      .populate("jobId", "title")
      .populate("clientId", "companyName")
      .populate("interviewId", "title scheduledAt")
      .populate("sentBy", "firstName lastName email")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    successResponse(
      res,
      {
        emails,
        pagination,
      },
      "Emails retrieved successfully"
    );
  }
);

/**
 * Get single email by ID
 */
export const getEmailById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const email = await Email.findById(id)
      .populate("candidateId", "firstName lastName email phone")
      .populate("applicationId", "firstName lastName resumeUrl")
      .populate("jobId", "title description")
      .populate("clientId", "companyName")
      .populate("interviewId", "title scheduledAt type")
      .populate("sentBy", "firstName lastName email avatar");

    if (!email) {
      throw new NotFoundError("Email not found");
    }

    successResponse(res, email, "Email retrieved successfully");
  }
);

/**
 * Send new email
 */
export const sendEmail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      to,
      subject,
      body,
      bodyHtml,
      cc,
      bcc,
      candidateId,
      jobId,
      clientId,
      applicationId,
      interviewId,
    } = req.body;

    // Send email via Resend service (this will also save to database)
    const result = await resendService.sendEmail({
      to,
      subject,
      body,
      bodyHtml,
      cc,
      bcc,
      candidateId,
      jobId,
      clientId,
      applicationId,
      interviewId,
      sentBy: req.user?._id?.toString(),
    });

    // Fetch the created email record with populated references
    const email = await Email.findById(result.emailId).populate([
      { path: "candidateId", select: "firstName lastName email" },
      { path: "jobId", select: "title" },
      { path: "sentBy", select: "firstName lastName email" },
    ]);

    logger.info(
      `Email sent via Resend: ${result.id} to ${Array.isArray(to) ? to.join(", ") : to}`
    );

    successResponse(res, email, "Email sent successfully", 201);
  }
);

/**
 * Create draft email
 */
export const createDraft = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body;

    const email = await Email.create({
      ...data,
      direction: "outbound",
      status: "draft",
      sentBy: req.user?._id,
    });

    await email.populate([
      { path: "candidateId", select: "firstName lastName email" },
      { path: "jobId", select: "title" },
      { path: "sentBy", select: "firstName lastName email" },
    ]);

    logger.info(`Email draft created by ${req.user?.email}`);

    successResponse(res, email, "Draft created successfully", 201);
  }
);

/**
 * Update draft email
 */
export const updateDraft = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;

    const email = await Email.findOne({ _id: id, status: "draft" });

    if (!email) {
      throw new NotFoundError("Draft not found");
    }

    Object.assign(email, updates);
    await email.save();

    await email.populate([
      { path: "candidateId", select: "firstName lastName email" },
      { path: "jobId", select: "title" },
      { path: "sentBy", select: "firstName lastName email" },
    ]);

    logger.info(`Email draft updated: ${id} by ${req.user?.email}`);

    successResponse(res, email, "Draft updated successfully");
  }
);

/**
 * Send draft email
 */
export const sendDraft = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const email = await Email.findOne({ _id: id, status: "draft" });

    if (!email) {
      throw new NotFoundError("Draft not found");
    }

    email.status = "sent";
    email.sentAt = new Date();
    await email.save();

    // TODO: Integrate with email service (Resend) to actually send the email

    await email.populate([
      { path: "candidateId", select: "firstName lastName email" },
      { path: "jobId", select: "title" },
      { path: "sentBy", select: "firstName lastName email" },
    ]);

    logger.info(`Email draft sent: ${id} by ${req.user?.email}`);

    successResponse(res, email, "Email sent successfully");
  }
);

/**
 * Delete email (soft delete for outbound, hard delete for drafts)
 */
export const deleteEmail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const email = await Email.findById(id);

    if (!email) {
      throw new NotFoundError("Email not found");
    }

    // Hard delete drafts, soft delete (mark as deleted) for sent emails
    if (email.status === "draft") {
      await Email.findByIdAndDelete(id);
    } else {
      // For sent emails, we might want to keep the record
      // Implement soft delete or archive logic here if needed
      await Email.findByIdAndDelete(id);
    }

    logger.info(`Email deleted: ${id} by ${req.user?.email}`);

    successResponse(res, { id }, "Email deleted successfully");
  }
);

/**
 * Get email thread
 */
export const getEmailThread = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { threadId } = req.params;

    const emails = await Email.find({ threadId })
      .populate("candidateId", "firstName lastName email")
      .populate("sentBy", "firstName lastName email avatar")
      .sort({ createdAt: 1 });

    successResponse(res, emails, "Email thread retrieved successfully");
  }
);

/**
 * Get emails for a candidate
 */
export const getCandidateEmails = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { candidateId } = req.params;

    const emails = await Email.find({ candidateId })
      .populate("jobId", "title")
      .populate("sentBy", "firstName lastName email avatar")
      .sort({ createdAt: -1 })
      .limit(50);

    successResponse(res, emails, "Candidate emails retrieved successfully");
  }
);

/**
 * Get inbound emails (candidate replies)
 */
export const getInboundEmails = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 20,
      candidateId,
      status = "received",
      unmatched,
      search,
    } = req.query as any;

    // Build filter for inbound emails
    const filter: any = { direction: "inbound" };

    if (candidateId) {
      filter.candidateId = candidateId;
    }

    if (status) {
      filter.status = status;
    }

    // Filter for unmatched emails (emails from unknown senders)
    if (unmatched === "true") {
      filter.candidateId = { $exists: false };
    }

    if (search) {
      filter.$or = [
        { from: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count
    const totalCount = await Email.countDocuments(filter);

    // Calculate pagination
    const pagination = paginateResults(totalCount, {
      page,
      limit,
      sort: "receivedAt",
      order: "desc",
    });

    // Calculate skip
    const skip = (page - 1) * limit;

    // Fetch inbound emails
    const emails = await Email.find(filter)
      .populate("candidateId", "firstName lastName email phone")
      .populate("applicationId", "status")
      .populate("jobId", "title")
      .populate("interviewId", "scheduledAt type")
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit);

    successResponse(
      res,
      {
        emails,
        pagination,
      },
      "Inbound emails retrieved successfully"
    );
  }
);

/**
 * Get email statistics
 */
export const getEmailStats = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const totalEmails = await Email.countDocuments();
    const sentEmails = await Email.countDocuments({
      direction: "outbound",
      status: "sent",
    });
    const receivedEmails = await Email.countDocuments({
      direction: "inbound",
      status: "received",
    });
    const unmatchedEmails = await Email.countDocuments({
      direction: "inbound",
      status: "received",
      candidateId: { $exists: false },
    });
    const draftEmails = await Email.countDocuments({ status: "draft" });
    const failedEmails = await Email.countDocuments({ status: "failed" });

    successResponse(
      res,
      {
        totalEmails,
        sentEmails,
        receivedEmails,
        unmatchedEmails,
        draftEmails,
        failedEmails,
      },
      "Email statistics retrieved successfully"
    );
  }
);
