import cron from 'node-cron';
import prisma from '../config/db.js';
import { createNotification } from './notifications.js';

export const initScheduler = () => {
    // Run every hour: "0 * * * *"
    cron.schedule('0 * * * *', async () => {
        console.log('⏰ Running due date check...');

        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            const tasks = await prisma.task.findMany({
                where: {
                    dueDate: {
                        lte: tomorrow,
                        gte: now
                    },
                    status: {
                        not: 'DONE'
                    },
                    isDeleted: false,
                    isArchived: false,
                    assigneeId: {
                        not: null
                    }
                }
            });

            for (const task of tasks) {
                if (task.assigneeId) {
                    // Check if we already notified this user about this task today
                    const existingNotification = await prisma.notification.findFirst({
                        where: {
                            userId: task.assigneeId,
                            type: 'DUE_DATE_NEAR',
                            title: 'Task deadline approaching',
                            link: {
                                contains: `taskId=${task.id}` // Use contains as link might have project param
                            },
                            createdAt: {
                                gte: new Date(new Date().setHours(0, 0, 0, 0)) // Since beginning of today
                            }
                        }
                    });

                    if (!existingNotification) {
                        await createNotification(
                            task.assigneeId,
                            'DUE_DATE_NEAR',
                            'Upcoming Deadline',
                            `The task "${task.title}" is due in less than 24 hours.`,
                            `/dashboard?project=${task.projectId}&task=${task.id}`
                        );
                    }
                }
            }

            if (tasks.length > 0) {
                console.log(`✅ Sent ${tasks.length} due date notifications.`);
            }
        } catch (error) {
            console.error('❌ Scheduler error:', error);
        }
    });
};
