import { Router } from 'express';
import * as searchController from './search.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, searchController.search);

export default router;
