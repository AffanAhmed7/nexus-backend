import type { Request, Response } from 'express';
import prisma from '../../config/db.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { io } from '../../index.js';
import { logActivity } from '../audit/audit.controller.js';
import { createNotification } from '../../utils/notifications.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { checkWorkspaceAdmin, getProjectWorkspaceId } from '../../utils/permissions.js';

export const createTask = asyncHandler(async (req: Request, res: Response) => {
    const { title, description, projectId, status, priority, assigneeId } = req.body;
    const userId = (req as AuthRequest).user?.id!;

    // Check permissions if assigneeId is provided
    if (assigneeId) {
        const workspaceId = await getProjectWorkspaceId(projectId);
        if (workspaceId) {
            const isAdmin = await checkWorkspaceAdmin(userId, workspaceId);
            if (!isAdmin) {
                return res.status(403).json({ message: 'Only admins can assign tasks' });
            }
        }
    }

    const task = await (prisma as any).task.create({
        data: {
            title,
            description,
            status: status || 'TODO',
            priority: priority || 'MEDIUM',
            projectId,
            assigneeId: assigneeId || null,
            creatorId: userId,
        },
    });

    // Notify assignee if it's someone else
    if (task.assigneeId && task.assigneeId !== userId) {
        await createNotification(
            task.assigneeId,
            'TASK_ASSIGNED',
            'New Assignment',
            `You have been assigned to the task: "${task.title}"`,
            `/dashboard?project=${task.projectId}&task=${task.id}`
        );
    }

    // Broadcast to project room
    io.to(projectId).emit('task_created', task);

    // Log Activity
    await logActivity(userId, task.id, 'CREATED', { title: task.title });

    res.status(201).json(task);
});

export const getTasksByProject = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
        prisma.task.findMany({
            where: {
                projectId,
                isDeleted: false,
                isArchived: req.query.archived === 'true'
            },
            include: {
                assignee: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                }
            },
            orderBy: { position: 'asc' },
            skip,
            take: limit,
        }),
        prisma.task.count({
            where: {
                projectId,
                isDeleted: false,
                isArchived: req.query.archived === 'true'
            }
        })
    ]);

    res.json({
        tasks,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total
        }
    });
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const updates = req.body;
    const userId = (req as AuthRequest).user?.id!;

    const oldTask = await prisma.task.findUnique({
        where: { id },
        include: {
            project: {
                select: { workspaceId: true }
            }
        }
    });

    if (!oldTask) return res.status(404).json({ message: 'Task not found' });

    // Permissions Check
    if (updates.isDeleted === true || (updates.assigneeId !== undefined && updates.assigneeId !== (oldTask as any).assigneeId)) {
        const isCreator = (oldTask as any).creatorId === userId;
        const isWorkspaceAdmin = await checkWorkspaceAdmin(userId, oldTask.project.workspaceId);

        // Restriction for Deletion
        if (updates.isDeleted === true && !isCreator && !isWorkspaceAdmin) {
            return res.status(403).json({ message: 'Insufficient permissions to delete this task' });
        }

        // Restriction for Assignment Change (Only Admin)
        if (updates.assigneeId !== undefined && updates.assigneeId !== oldTask.assigneeId && !isWorkspaceAdmin) {
            return res.status(403).json({ message: 'Only workspace admins can assign tasks' });
        }
    }

    const task = await prisma.task.update({
        where: { id },
        data: updates,
        include: {
            assignee: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true
                }
            }
        }
    });

    // Notify on assignment change
    if (updates.assigneeId && updates.assigneeId !== userId && updates.assigneeId !== oldTask?.assigneeId) {
        await createNotification(
            updates.assigneeId,
            'TASK_ASSIGNED',
            'New Assignment',
            `You have been assigned to the task: "${task.title}"`,
            `/dashboard?project=${task.projectId}&task=${task.id}`
        );
    }

    // Broadcast update
    io.to(task.projectId).emit('task_updated', task);

    // Log Activity
    if (updates.status && updates.status !== oldTask?.status) {
        await logActivity(userId, id, `MOVED_TO_${updates.status}`, { oldStatus: oldTask?.status, newStatus: updates.status });
    } else if (updates.assigneeId !== undefined && updates.assigneeId !== (oldTask as any).assigneeId) {
        const action = updates.assigneeId ? 'ASSIGNED' : 'UNASSIGNED';
        await logActivity(userId, id, action, { assigneeId: updates.assigneeId });
    } else {
        const { isDeleted, position, ...changeMeta } = updates;
        if (Object.keys(changeMeta).length > 0) {
            await logActivity(userId, id, 'UPDATED', changeMeta);
        }
    }

    res.json(task);
});

export const archiveTask = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const userId = (req as AuthRequest).user?.id!;

    const task = await prisma.task.findUnique({
        where: { id },
        include: { project: { select: { workspaceId: true } } }
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isWorkspaceAdmin = await checkWorkspaceAdmin(userId, task.project.workspaceId);
    const isCreator = task.creatorId === userId;

    if (!isWorkspaceAdmin && !isCreator) {
        return res.status(403).json({ message: 'Insufficient permissions to archive this task' });
    }

    const updatedTask = await prisma.task.update({
        where: { id },
        data: { isArchived: true }
    });

    io.to(task.projectId).emit('task_updated', updatedTask);
    await logActivity(userId, id, 'ARCHIVED', { title: task.title });

    res.json(updatedTask);
});

export const unarchiveTask = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const userId = (req as AuthRequest).user?.id!;

    const task = await prisma.task.findUnique({
        where: { id },
        include: { project: { select: { workspaceId: true } } }
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isWorkspaceAdmin = await checkWorkspaceAdmin(userId, task.project.workspaceId);
    const isCreator = task.creatorId === userId;

    if (!isWorkspaceAdmin && !isCreator) {
        return res.status(403).json({ message: 'Insufficient permissions to unarchive this task' });
    }

    const updatedTask = await prisma.task.update({
        where: { id },
        data: { isArchived: false }
    });

    io.to(task.projectId).emit('task_updated', updatedTask);
    await logActivity(userId, id, 'UNARCHIVED', { title: task.title });

    res.json(updatedTask);
});
