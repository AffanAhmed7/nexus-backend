import type { Response } from 'express';
import prisma from '../../config/db.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const getNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user?.id },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(notifications);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as { id: string };
    try {
        await prisma.notification.updateMany({
            where: { id, userId: req.user?.id },
            data: { isRead: true }
        });
        res.json({ message: 'Marked as read' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const result = await prisma.notification.updateMany({
            where: { userId: req.user?.id, isRead: false },
            data: { isRead: true }
        });
        console.log(`Marked ${result.count} notifications as read for user ${req.user?.id}`);
        res.json({ message: 'All marked as read', count: result.count });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteAllNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const result = await prisma.notification.deleteMany({
            where: { userId: req.user?.id }
        });
        res.json({ message: 'All notifications cleared', count: result.count });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
