import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import bcrypt from 'bcryptjs';
import prisma from '../../config/db.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/auth.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
            },
        });

        const accessToken = generateAccessToken({ id: user.id, role: user.role });
        const refreshToken = generateRefreshToken({ id: user.id });

        res.status(201).json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: 'No account found with this email' });
        }

        if (!user.password) {
            return res.status(400).json({ message: 'This account uses Google Login. Please sign in with Google.' });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        const accessToken = generateAccessToken({ id: user.id, role: user.role });
        const refreshToken = generateRefreshToken({ id: user.id });

        res.status(200).json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong' });
    }
};

export const refresh = async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });

        const decoded: any = verifyRefreshToken(refreshToken);
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });

        if (!user) return res.status(404).json({ message: 'User not found' });

        const accessToken = generateAccessToken({ id: user.id, role: user.role });

        res.status(200).json({ accessToken });
    } catch (error) {
        res.status(403).json({ message: 'Invalid refresh token' });
    }
};

export const getMe = async (req: AuthRequest, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user?.id },
            select: { id: true, email: true, name: true, role: true, avatarUrl: true, notificationPrefs: true, createdAt: true }
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong' });
    }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        const { name, avatarUrl, notificationPrefs } = req.body;
        const user = await prisma.user.update({
            where: { id: req.user?.id },
            data: {
                ...(name && { name }),
                ...(avatarUrl !== undefined && { avatarUrl }),
                ...(notificationPrefs && { notificationPrefs })
            },
            select: { id: true, email: true, name: true, role: true, avatarUrl: true, notificationPrefs: true }
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong' });
    }
};

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/avatars/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

export const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images (jpeg, jpg, png, webp) are allowed'));
    }
});

export const uploadAvatar = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a file' });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        const user = await prisma.user.update({
            where: { id: req.user?.id },
            data: { avatarUrl },
            select: { id: true, email: true, name: true, role: true, avatarUrl: true, notificationPrefs: true }
        });

        res.json(user);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Something went wrong' });
    }
};

export const removeAvatar = async (req: AuthRequest, res: Response) => {
    try {
        const user = await prisma.user.update({
            where: { id: req.user?.id },
            data: { avatarUrl: null },
            select: { id: true, email: true, name: true, role: true, avatarUrl: true, notificationPrefs: true }
        });
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Something went wrong' });
    }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user?.id } });

        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.password) {
            return res.status(400).json({ message: 'No password set for this account (Google Login).' });
        }

        const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedNewPassword }
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong' });
    }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        // Delete user (Prisma cascade will handle memberships, notifications, etc.)
        await prisma.user.delete({
            where: { id: userId }
        });

        // Emit account_deleted to force logout on all clients
        // Note: For a real app, you might want to invalidate refresh tokens too
        // io.to(`user_${userId}`).emit('account_deleted'); // Need to import io if used

        res.json({ message: 'Account deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Something went wrong' });
    }
};

export const googleLogin = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token is required' });

        const admin = (await import('../../config/firebase.js')).default;
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (authError) {
            console.error("Firebase Verify Error:", authError);
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        const { uid, email, name, picture } = decodedToken;

        if (!email) {
            return res.status(400).json({ message: 'Google account must have an email' });
        }

        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { googleId: uid }
                ]
            }
        });

        if (user) {
            if (!user.googleId) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { googleId: uid, avatarUrl: user.avatarUrl || picture }
                });
            }
        } else {
            user = await prisma.user.create({
                data: {
                    email,
                    name: name || email.split('@')[0],
                    googleId: uid,
                    avatarUrl: picture,
                    role: 'MEMBER',
                    password: null,
                }
            });
        }

        const accessToken = generateAccessToken({ id: user.id, role: user.role });
        const refreshToken = generateRefreshToken({ id: user.id });

        res.status(200).json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
            accessToken,
            refreshToken,
        });

    } catch (error: any) {
        console.error("Google Login Error:", error);
        res.status(500).json({ message: error.message || 'Something went wrong processing Google Login' });
    }
};
