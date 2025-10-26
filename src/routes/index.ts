import { Router } from 'express';
import emailAccountRoutes from './emailAccount.routes';
import resumeRoutes from './resume.routes';
import applicationRoutes from './application.routes';
import candidateRoutes from './candidate.routes';
import jobRoutes from './job.routes';
import clientRoutes from './client.routes';
import pipelineRoutes from './pipeline.routes';
import categoryRoutes from './category.routes';
import tagRoutes from './tag.routes';
import userRoutes from './user.routes';
import teamMemberRoutes from './teamMember.routes';
import interviewRoutes from './interview.routes';
import emailRoutes from './email.routes';
import notificationRoutes from './notification.routes';
import messageRoutes from './message.routes';

const router = Router();

// API Routes
router.use('/users', userRoutes);
router.use('/team', teamMemberRoutes);
router.use('/interviews', interviewRoutes);
router.use('/emails', emailRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/email-accounts', emailAccountRoutes);
router.use('/resumes', resumeRoutes);
router.use('/applications', applicationRoutes);
router.use('/candidates', candidateRoutes);
router.use('/jobs', jobRoutes);
router.use('/clients', clientRoutes);
router.use('/pipelines', pipelineRoutes);
router.use('/categories', categoryRoutes);
router.use('/tags', tagRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'success',
    message: 'ATS Backend API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
