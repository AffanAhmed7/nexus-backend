import { Router } from 'express';
import * as auditController from './audit.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/project/:projectId', authenticate, auditController.getProjectLogs);
router.delete('/project/:projectId', authenticate, auditController.deleteProjectLogs);
router.get('/workspace/:workspaceId', authenticate, auditController.getWorkspaceLogs);
router.delete('/workspace/:workspaceId', authenticate, auditController.deleteWorkspaceLogs);

export default router;
