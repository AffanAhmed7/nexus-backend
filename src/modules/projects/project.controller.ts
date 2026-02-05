import type { Request, Response } from 'express';
import prisma from '../../config/db.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { io } from '../../index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { checkWorkspaceAdmin } from '../../utils/permissions.js';

export const createProject = asyncHandler(async (req: Request, res: Response) => {
    const { name, description, workspaceId } = req.body;
    const userId = (req as AuthRequest).user?.id!;

    // Verify membership and role
    const isAdmin = await checkWorkspaceAdmin(userId, workspaceId);
    if (!isAdmin) {
        return res.status(403).json({ message: 'Only admins can create projects' });
    }

    const project = await prisma.project.create({
        data: {
            name,
            description,
            workspaceId,
        }
    });

    // Broadcast to workspace room
    io.to(`workspace_${workspaceId}`).emit('project_created', project);

    res.status(201).json(project);
});

export const getProjectsByWorkspace = asyncHandler(async (req: Request, res: Response) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const userId = (req as AuthRequest).user?.id!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const membership = await prisma.workspaceMember.findFirst({
        where: {
            workspaceId,
            userId,
            status: 'ACCEPTED'
        }
    });

    if (!membership) {
        return res.status(403).json({ message: 'Not a member of this workspace' });
    }

    const [projectsRaw, total] = await Promise.all([
        prisma.project.findMany({
            where: { workspaceId },
            include: {
                tasks: {
                    where: {
                        isDeleted: false,
                        isArchived: false
                    },
                    select: { status: true }
                }
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' }
        }),
        prisma.project.count({
            where: { workspaceId }
        })
    ]);

    const projects = projectsRaw.map(p => {
        const totalTasks = p.tasks.length;
        const completedTasks = p.tasks.filter((t: any) => t.status === 'DONE').length;
        const { tasks, ...projectData } = p;
        return {
            ...projectData,
            totalTasks,
            completedTasks
        };
    });

    res.json({
        projects,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total
        }
    });
});

export const getProjectStats = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params as { projectId: string };

    const tasks = await prisma.task.findMany({
        where: {
            projectId,
            isDeleted: false
        }
    });

    const statusCounts = {
        TODO: tasks.filter((t: any) => t.status === 'TODO').length,
        IN_PROGRESS: tasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
        IN_REVIEW: tasks.filter((t: any) => t.status === 'IN_REVIEW').length,
        DONE: tasks.filter((t: any) => t.status === 'DONE').length
    };

    const priorityCounts = {
        LOW: tasks.filter((t: any) => t.priority === 'LOW').length,
        MEDIUM: tasks.filter((t: any) => t.priority === 'MEDIUM').length,
        HIGH: tasks.filter((t: any) => t.priority === 'HIGH').length
    };

    const total = tasks.length;
    const completionRate = total > 0 ? (statusCounts.DONE / total) * 100 : 0;

    // Recently completed (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTrend = tasks
        .filter((t: any) => t.status === 'DONE' && t.updatedAt >= sevenDaysAgo)
        .reduce((acc: any, task: any) => {
            const day = task.updatedAt.toISOString().split('T')[0];
            acc[day] = (acc[day] || 0) + 1;
            return acc;
        }, {});

    res.json({
        statusCounts,
        priorityCounts,
        total,
        completionRate,
        recentTrend: Object.entries(recentTrend).map(([day, count]) => ({ day, count }))
    });
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const userId = (req as AuthRequest).user?.id!;

    const project = await prisma.project.findUnique({
        where: { id },
        include: { workspace: true }
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Check if user is admin in that workspace
    const isAdmin = await checkWorkspaceAdmin(userId, project.workspaceId);
    if (!isAdmin) {
        return res.status(403).json({ message: 'Only admins can delete projects' });
    }

    await prisma.project.delete({ where: { id } });

    // Emit project_deleted
    io.to(`project_${id}`).emit('project_deleted', { projectId: id, workspaceId: project.workspaceId });

    res.json({ message: 'Project deleted successfully' });
});
