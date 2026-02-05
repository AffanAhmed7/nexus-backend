import { Router } from 'express';
import { register, login, refresh, updateProfile, getMe, changePassword, deleteAccount, uploadAvatar, upload, removeAvatar, googleLogin } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/refresh', refresh);
router.get('/me', authenticate, getMe);
router.patch('/update-profile', authenticate, updateProfile);
router.post('/upload-avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.delete('/avatar', authenticate, removeAvatar);
router.post('/change-password', authenticate, changePassword);
router.delete('/delete-account', authenticate, deleteAccount);

export default router;
