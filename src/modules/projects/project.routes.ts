import { Router } from 'express';
import { createProject, getProjectsByWorkspace, getProjectStats, deleteProject } from './project.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, createProject);
router.get('/workspace/:workspaceId', authenticate, getProjectsByWorkspace);
router.get('/:projectId/stats', authenticate, getProjectStats);
router.delete('/:id', authenticate, deleteProject);

export default router;
