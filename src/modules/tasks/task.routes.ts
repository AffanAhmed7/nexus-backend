import { Router } from 'express';
import { createTask, getTasksByProject, updateTask, archiveTask, unarchiveTask } from './task.controller.js';
import * as auditController from '../audit/audit.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, createTask);
router.get('/project/:projectId', authenticate, getTasksByProject);
router.patch('/:id', authenticate, updateTask);
router.post('/:id/archive', authenticate, archiveTask);
router.post('/:id/unarchive', authenticate, unarchiveTask);
router.get('/:taskId/history', authenticate, auditController.getTaskLogs);

export default router;
