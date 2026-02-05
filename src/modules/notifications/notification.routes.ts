import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, deleteAllNotifications } from './notification.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getNotifications);
router.patch('/read-all', authenticate, markAllAsRead);
router.patch('/:id/read', authenticate, markAsRead);
router.delete('/', authenticate, deleteAllNotifications);

export default router;
