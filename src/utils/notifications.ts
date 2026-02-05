import prisma from '../config/db.js';
import { io } from '../index.js';

export const createNotification = async (userId: string, type: string, title: string, message: string, link?: string) => {
    try {
        // Fetch user preferences
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { notificationPrefs: true }
        });

        if (user && user.notificationPrefs) {
            const prefs = user.notificationPrefs as any;

            // Check In-App preference
            if (prefs.inApp === false) {
                return null;
            }

            // Check specific types
            if (type === 'TASK_ASSIGNED' && prefs.taskAssigned === false) return null;
            if (type === 'COMMENT_ADDED' && prefs.taskComment === false) return null;
        }

        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                link
            }
        });

        // Emit real-time notification to the user's personal room
        io.to(`user_${userId}`).emit('notification', notification);

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};
