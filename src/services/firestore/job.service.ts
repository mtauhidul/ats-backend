import { FirestoreBaseService, QueryFilter } from './base.service';
import logger from '../../utils/logger';
import { config } from '../../config';

export interface FirestoreJobData {
  title: string;
  companyId: string;
  clientId: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  location: string;
  locationType: 'onsite' | 'hybrid' | 'remote';
  jobType: 'full_time' | 'part_time' | 'contract' | 'internship';
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  skills: string[];
  benefits?: string[];
  pipelineId?: string;
  categoryIds: string[];
  tagIds: string[];
  status: 'draft' | 'open' | 'closed' | 'on_hold';
  openings: number;
  applicationDeadline?: Date;
  startDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  hiringManagerId?: string;
  recruiterIds: string[];
  createdBy: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Job Firestore Service
 * Handles all job-related Firestore operations
 */
export class JobFirestoreService extends FirestoreBaseService<FirestoreJobData> {
  constructor(companyId: string) {
    super(`companies/${companyId}/jobs`);
  }

  /**
   * Find jobs by status
   */
  async findByStatus(status: string): Promise<(FirestoreJobData & { id: string })[]> {
    try {
      const filters: QueryFilter[] = [{ field: 'status', operator: '==', value: status }];
      return await this.find(filters, {
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
      });
    } catch (error) {
      logger.error('Error finding jobs by status:', error);
      throw error;
    }
  }

  /**
   * Find jobs by client
   */
  async findByClient(clientId: string): Promise<(FirestoreJobData & { id: string })[]> {
    try {
      const filters: QueryFilter[] = [{ field: 'clientId', operator: '==', value: clientId }];
      return await this.find(filters, {
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
      });
    } catch (error) {
      logger.error('Error finding jobs by client:', error);
      throw error;
    }
  }

  /**
   * Find open jobs
   */
  async findOpenJobs(): Promise<(FirestoreJobData & { id: string })[]> {
    return this.findByStatus('open');
  }

  /**
   * Find jobs by location type
   */
  async findByLocationType(
    locationType: 'onsite' | 'hybrid' | 'remote'
  ): Promise<(FirestoreJobData & { id: string })[]> {
    try {
      const filters: QueryFilter[] = [
        { field: 'locationType', operator: '==', value: locationType },
        { field: 'status', operator: '==', value: 'open' },
      ];
      return await this.find(filters);
    } catch (error) {
      logger.error('Error finding jobs by location type:', error);
      throw error;
    }
  }

  /**
   * Find jobs by priority
   */
  async findByPriority(
    priority: 'low' | 'medium' | 'high' | 'urgent'
  ): Promise<(FirestoreJobData & { id: string })[]> {
    try {
      const filters: QueryFilter[] = [{ field: 'priority', operator: '==', value: priority }];
      return await this.find(filters, {
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
      });
    } catch (error) {
      logger.error('Error finding jobs by priority:', error);
      throw error;
    }
  }

  /**
   * Update job status
   */
  async updateStatus(jobId: string, status: 'draft' | 'open' | 'closed' | 'on_hold'): Promise<void> {
    try {
      await this.update(jobId, {
        status,
      } as Partial<FirestoreJobData>);
      logger.info(`Updated job ${jobId} status to ${status}`);
    } catch (error) {
      logger.error('Error updating job status:', error);
      throw error;
    }
  }

  /**
   * Get jobs with pagination
   */
  async getPaginated(
    page: number = 1,
    limit: number = 20,
    filters?: { status?: string; clientId?: string; priority?: string }
  ): Promise<{
    jobs: (FirestoreJobData & { id: string })[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      const queryFilters: QueryFilter[] = [];

      if (filters?.status) {
        queryFilters.push({ field: 'status', operator: '==', value: filters.status });
      }
      if (filters?.clientId) {
        queryFilters.push({ field: 'clientId', operator: '==', value: filters.clientId });
      }
      if (filters?.priority) {
        queryFilters.push({ field: 'priority', operator: '==', value: filters.priority });
      }

      const jobs = await this.find(queryFilters, {
        limit,
        offset,
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
      });

      const total = await this.count(queryFilters);
      const totalPages = Math.ceil(total / limit);

      return {
        jobs,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting paginated jobs:', error);
      throw error;
    }
  }

  /**
   * Get job statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    try {
      const total = await this.count();

      // Get counts by status
      const statuses = ['draft', 'open', 'closed', 'on_hold'];
      const byStatus: Record<string, number> = {};

      await Promise.all(
        statuses.map(async (status) => {
          const count = await this.count([{ field: 'status', operator: '==', value: status }]);
          byStatus[status] = count;
        })
      );

      // Get counts by priority
      const priorities = ['low', 'medium', 'high', 'urgent'];
      const byPriority: Record<string, number> = {};

      await Promise.all(
        priorities.map(async (priority) => {
          const count = await this.count([{ field: 'priority', operator: '==', value: priority }]);
          byPriority[priority] = count;
        })
      );

      return { total, byStatus, byPriority };
    } catch (error) {
      logger.error('Error getting job statistics:', error);
      throw error;
    }
  }

  /**
   * Subscribe to job changes (real-time)
   */
  subscribeToJob(jobId: string, callback: (job: (FirestoreJobData & { id: string }) | null) => void): () => void {
    return this.subscribeToDocument(jobId, callback);
  }

  /**
   * Subscribe to all open jobs (real-time)
   */
  subscribeToOpenJobs(callback: (jobs: (FirestoreJobData & { id: string })[]) => void): () => void {
    const filters: QueryFilter[] = [{ field: 'status', operator: '==', value: 'open' }];
    return this.subscribeToCollection(filters, callback, {
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
    });
  }
}

// Export singleton instance with default company ID
export const jobService = new JobFirestoreService(config.migration.defaultCompanyId);

// Export type alias for consistency
export type IJob = FirestoreJobData;
