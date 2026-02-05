import { Router } from 'express';
import { createWorkspace, getWorkspaces, getWorkspaceById, inviteUser, respondToInvitation, updateMemberRole, removeMember, deleteWorkspace } from './workspace.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, createWorkspace);
router.get('/', authenticate, getWorkspaces);
router.get('/:id', authenticate, getWorkspaceById);
router.post('/invite', authenticate, inviteUser);
router.post('/respond', authenticate, respondToInvitation);
router.patch('/update-role', authenticate, updateMemberRole);
router.post('/remove-member', authenticate, removeMember);
router.delete('/:id', authenticate, deleteWorkspace);

export default router;
