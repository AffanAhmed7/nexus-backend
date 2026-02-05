import type { Response } from 'express';
import prisma from '../../config/db.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { io } from '../../index.js';
import { createNotification } from '../../utils/notifications.js';
import { logActivity } from '../audit/audit.controller.js';

export const addComment = async (req: AuthRequest, res: Response) => {
    const { text, taskId } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const comment = await prisma.comment.create({
            data: {
                text: text || req.body.content, // Support both for transition period
                taskId,
                authorId: userId,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    }
                }
            }
        });

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { projectId: true, assigneeId: true, title: true, id: true }
        });

        if (task) {
            io.to(task.projectId).emit('comment_added', comment);

            // Notify assignee if someone else comments
            if (task.assigneeId && task.assigneeId !== userId) {
                await createNotification(
                    task.assigneeId,
                    'COMMENT_ADDED',
                    'New Comment',
                    `${comment.author.name} posted a comment on task "${task.title}"`,
                    `/dashboard?project=${task.projectId}&task=${task.id}`
                );
            }

            // Log activity in task history
            await logActivity(userId, taskId, 'COMMENT_ADDED', { author: comment.author.name });
        }

        res.status(201).json(comment);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getTaskComments = async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params as { taskId: string };

    try {
        const comments = await prisma.comment.findMany({
            where: { taskId },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    }
                }
            },
            orderBy: { createdAt: 'asc' },
        });
        res.json(comments);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
    const { commentId } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            include: {
                task: { select: { projectId: true } }
            }
        });

        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        // Check permissions: Author OR Project/Workspace Admin
        // For simplicity, we check if user is author. 
        // For Admin check, we'd need to look up the workspace role.
        // Let's assume frontend hides it, but backend should verify.

        let canDelete = comment.authorId === userId;

        if (!canDelete) {
            // Check if user is an admin of the workspace
            // We need to fetch the project -> workspace -> member(user)
            const project = await prisma.project.findUnique({
                where: { id: comment.task.projectId },
                include: { workspace: { include: { members: { where: { userId } } } } }
            });

            const member = project?.workspace.members[0];
            if (member && member.role === 'ADMIN') {
                canDelete = true;
            }
        }

        if (!canDelete) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        await prisma.comment.delete({ where: { id: commentId } });

        io.to(comment.task.projectId).emit('comment_deleted', { commentId, taskId: comment.taskId });

        // Log activity
        await logActivity(userId, comment.taskId, 'COMMENT_DELETED', { commentId });

        res.json({ message: 'Comment deleted' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
