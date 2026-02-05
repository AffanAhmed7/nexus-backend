import { Router } from 'express';
import * as commentController from './comment.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, commentController.addComment);
router.get('/task/:taskId', authenticate, commentController.getTaskComments);
router.delete('/:commentId', authenticate, commentController.deleteComment);

export default router;
