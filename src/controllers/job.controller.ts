import { Request, Response } from "express";
import { jobService, pipelineService, candidateService, applicationService, categoryService, clientService } from "../services/firestore";
import {
  BulkUpdateJobStatusInput,
  CreateJobInput,
  ListJobsQuery,
  UpdateJobInput,
} from "../types/job.types";
import {
  ValidationError as CustomValidationError,
  NotFoundError,
} from "../utils/errors";
import {
  asyncHandler,
  paginateResults,
  successResponse,
} from "../utils/helpers";
import logger from "../utils/logger";

/**
 * Create new job posting
 */
export const createJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateJobInput = req.body;

    // If pipelineId provided, verify it exists
    if (data.pipelineId) {
      const pipeline = await pipelineService.findById(data.pipelineId);
      if (!pipeline) {
        throw new NotFoundError("Pipeline not found");
      }
    }

    // Create job
    const jobId = await jobService.create({
      ...data,
      createdBy: req.user?.id,
    } as any);

    // Fetch created job
    const job = await jobService.findById(jobId);
    
    if (!job) {
      throw new Error("Failed to create job");
    }

    logger.info(`Job created: ${job.title} by user ${req.user?.id}`);

    successResponse(res, job, "Job created successfully", 201);
  }
);

/**
 * Get all jobs with filters and pagination
 */
export const getJobs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      clientId,
      status,
      jobType,
      experienceLevel,
      locationType,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query as any as ListJobsQuery;

    // Fetch all jobs
    let allJobs = await jobService.find([]);

    // Apply filters in memory
    if (clientId) {
      allJobs = allJobs.filter((job: any) => job.clientId === clientId);
    }
    if (status) {
      allJobs = allJobs.filter((job: any) => job.status === status);
    }
    if (jobType) {
      allJobs = allJobs.filter((job: any) => job.jobType === jobType);
    }
    if (experienceLevel) {
      allJobs = allJobs.filter((job: any) => job.experienceLevel === experienceLevel);
    }
    if (locationType) {
      allJobs = allJobs.filter((job: any) => job.locationType === locationType);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      allJobs = allJobs.filter((job: any) =>
        job.title?.toLowerCase().includes(searchLower) ||
        job.description?.toLowerCase().includes(searchLower) ||
        job.location?.toLowerCase().includes(searchLower)
      );
    }

    // Get total count after filtering
    const totalCount = allJobs.length;

    // Calculate pagination
    const pagination = paginateResults(totalCount, {
      page,
      limit,
      sort: sortBy,
      order: sortOrder,
    });

    // Apply sorting
    allJobs.sort((a: any, b: any) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const skip = (page - 1) * limit;
    const jobs = allJobs.slice(skip, skip + limit);

    // Get job IDs for candidate lookup
    const jobIds = jobs.map((j: any) => j.id);
    
    // Fetch ALL candidates for ALL jobs
    const allCandidates = await candidateService.find([]);
    
    // Filter candidates that have any of these job IDs in their jobIds array
    const relevantCandidates = allCandidates.filter((candidate: any) =>
      candidate.jobIds?.some((jobId: string) => jobIds.includes(jobId))
    );
    
    // Calculate statistics for each job in memory
    const statsMap = new Map();
    
    jobIds.forEach((jobId: string) => {
      const jobCandidates = relevantCandidates.filter((candidate: any) =>
        candidate.jobIds?.includes(jobId)
      );
      
      const total = jobCandidates.length;
      const active = jobCandidates.filter((c: any) =>
        ["active", "interviewing", "offered"].includes(c.status)
      ).length;
      const hired = jobCandidates.filter((c: any) =>
        c.status === "hired"
      ).length;
      
      statsMap.set(jobId, {
        totalCandidates: total,
        activeCandidates: active,
        hiredCandidates: hired,
      });
    });
    
    // Add statistics to each job
    const jobsWithStats = jobs.map((job: any) => {
      const jobId = job.id;
      const stats = statsMap.get(jobId) || {
        totalCandidates: 0,
        activeCandidates: 0,
        hiredCandidates: 0,
      };

      return {
        ...job,
        statistics: stats,
      };
    });

    // Populate categories for all jobs
    const allCategoryIds = new Set<string>();
    const allClientIds = new Set<string>();
    
    jobsWithStats.forEach((job: any) => {
      if (job.categoryIds && Array.isArray(job.categoryIds)) {
        job.categoryIds.forEach((id: string) => allCategoryIds.add(id));
      }
      if (job.clientId) {
        allClientIds.add(job.clientId);
      }
    });

    // Fetch all unique categories
    const categoriesMap = new Map();
    if (allCategoryIds.size > 0) {
      const categories = await categoryService.find([]);
      categories.forEach((cat: any) => {
        categoriesMap.set(cat.id, cat);
      });
    }

    // Fetch all unique clients
    const clientsMap = new Map();
    if (allClientIds.size > 0) {
      console.log('📋 Client IDs to fetch:', Array.from(allClientIds));
      const clients = await clientService.find([]);
      console.log('📋 Clients fetched:', clients.length);
      console.log('📋 First client:', clients[0]);
      clients.forEach((client: any) => {
        clientsMap.set(client.id, client);
      });
      console.log('📋 Clients map size:', clientsMap.size);
    }

    // Replace category IDs and client IDs with populated objects
    const jobsWithPopulatedData = jobsWithStats.map((job: any) => {
      const result: any = { ...job };
      
      // Populate categories
      if (job.categoryIds && Array.isArray(job.categoryIds)) {
        const populatedCategories = job.categoryIds
          .map((id: string) => categoriesMap.get(id))
          .filter((cat: any) => cat !== undefined);
        result.categoryIds = populatedCategories;
      }
      
      // Populate client
      if (job.clientId) {
        const client = clientsMap.get(job.clientId);
        console.log(`🔍 Job "${job.title}" clientId:`, job.clientId);
        console.log(`🔍 Found client:`, client ? client.companyName : 'NOT FOUND');
        if (client) {
          result.clientId = {
            id: client.id,
            _id: client.id,
            companyName: client.companyName,
            logo: client.logo,
          };
        }
      }
      
      return result;
    });

    successResponse(
      res,
      {
        jobs: jobsWithPopulatedData,
        pagination,
      },
      "Jobs retrieved successfully"
    );
  }
);

/**
 * Get single job by ID
 */
export const getJobById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const job = await jobService.findById(id);

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    // Get candidate statistics
    const allCandidates = await candidateService.find([]);
    
    const jobCandidates = allCandidates.filter((c: any) =>
      c.jobIds?.includes(id)
    );

    const totalCandidates = jobCandidates.length;
    const activeCandidates = jobCandidates.filter((c: any) =>
      ["active", "interviewing", "offered"].includes(c.status)
    ).length;
    const hiredCandidates = jobCandidates.filter((c: any) =>
      c.status === "hired"
    ).length;

    // Populate categories
    let populatedCategoryIds = job.categoryIds;
    if (job.categoryIds && Array.isArray(job.categoryIds) && job.categoryIds.length > 0) {
      const categories = await categoryService.find([]);
      const categoriesMap = new Map();
      categories.forEach((cat: any) => {
        categoriesMap.set(cat.id, cat);
      });
      
      populatedCategoryIds = job.categoryIds
        .map((id: string) => categoriesMap.get(id))
        .filter((cat: any) => cat !== undefined);
    }

    // Populate client
    let populatedClient: any = job.clientId;
    if (job.clientId && typeof job.clientId === 'string') {
      const client = await clientService.findById(job.clientId);
      if (client) {
        populatedClient = {
          id: client.id,
          _id: client.id,
          companyName: (client as any).companyName,
          logo: (client as any).logo,
        };
      }
    }

    successResponse(
      res,
      {
        ...job,
        categoryIds: populatedCategoryIds,
        clientId: populatedClient,
        statistics: {
          totalCandidates,
          activeCandidates,
          hiredCandidates,
        },
      },
      "Job retrieved successfully"
    );
  }
);

/**
 * Update job
 */
export const updateJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates: UpdateJobInput = req.body;

    logger.info(`=== Updating Job ${id} ===`);
    logger.info("Updates received:", JSON.stringify(updates, null, 2));
    logger.info("Requirements field:", updates.requirements);
    logger.info("Skills field:", updates.skills);

    // If pipelineId is being changed, verify it exists
    if (updates.pipelineId) {
      const pipeline = await pipelineService.findById(updates.pipelineId);
      if (!pipeline) {
        throw new NotFoundError("Pipeline not found");
      }

      // Get the first stage of the pipeline
      const firstStage = pipeline.stages && pipeline.stages.length > 0 
        ? pipeline.stages[0] 
        : null;

      if (firstStage) {
        // Find all candidates with this job in their jobIds array and no stage
        const allCandidates = await candidateService.find([]);
        const candidatesToUpdate = allCandidates.filter((c: any) =>
          c.jobIds?.includes(id) && !c.currentStage
        );

        if (candidatesToUpdate.length > 0) {
          // Update each candidate to set the first stage
          await Promise.all(
            candidatesToUpdate.map((candidate: any) =>
              candidateService.update(candidate.id, {
                currentStage: firstStage.id
              })
            )
          );

          logger.info(
            `Assigned ${candidatesToUpdate.length} candidates to first stage "${firstStage.name}" of pipeline "${pipeline.name}"`
          );
        }
      }
    }

    // Update job
    await jobService.update(id, {
      ...updates,
      updatedBy: req.user?.id,
    } as any);

    // Get updated job
    const job = await jobService.findById(id);

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    logger.info(`Job updated: ${job.title}`);

    successResponse(res, job, "Job updated successfully");
  }
);

/**
 * Delete job
 */
export const deleteJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const job = await jobService.findById(id);

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    // Check if there are applications
    const allApplications = await applicationService.find([]);
    const jobApplications = allApplications.filter((app: any) => app.jobId === id);

    if (jobApplications.length > 0) {
      throw new CustomValidationError(
        `Cannot delete job with ${jobApplications.length} applications. Please close the job instead.`
      );
    }

    await jobService.delete(id);

    logger.info(`Job deleted: ${job.title}`);

    successResponse(res, null, "Job deleted successfully");
  }
);

/**
 * Bulk update job status
 */
export const bulkUpdateJobStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { jobIds, status }: BulkUpdateJobStatusInput = req.body;

    // Validate all IDs (simple string validation for Firestore)
    const validIds = jobIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (validIds.length !== jobIds.length) {
      throw new CustomValidationError("Some job IDs are invalid");
    }

    // Update jobs in a loop
    let modifiedCount = 0;
    await Promise.all(
      validIds.map(async (id) => {
        try {
          await jobService.update(id, { 
            status, 
            updatedBy: req.user?.id 
          } as any);
          modifiedCount++;
        } catch (error) {
          logger.error(`Failed to update job ${id}:`, error);
        }
      })
    );

    logger.info(
      `Bulk updated ${modifiedCount} jobs to status: ${status}`
    );

    successResponse(
      res,
      {
        modifiedCount,
        status,
      },
      `Successfully updated ${modifiedCount} jobs`
    );
  }
);

/**
 * Get job statistics
 */
export const getJobStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { clientId } = req.query;

    // Fetch all jobs
    let allJobs = await jobService.find([]);
    
    // Apply filter if clientId is provided
    if (clientId) {
      allJobs = allJobs.filter((job: any) => job.clientId === clientId);
    }

    // Calculate statistics in memory
    const total = allJobs.length;
    
    // Group by status
    const byStatus = allJobs.reduce((acc: any, job: any) => {
      const status = job.status || 'draft';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    // Group by employment type
    const byEmploymentType = allJobs.reduce((acc: any, job: any) => {
      const empType = job.employmentType || 'full_time';
      acc[empType] = (acc[empType] || 0) + 1;
      return acc;
    }, {});

    const result = {
      total,
      byStatus,
      byEmploymentType,
    };

    successResponse(res, result, "Job statistics retrieved successfully");
  }
);
