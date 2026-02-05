import type { Response } from 'express';
import prisma from '../../config/db.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const getProjectLogs = async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };

    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                task: {
                    projectId: projectId
                }
            },
            include: {
                user: {
                    select: { name: true }
                },
                task: {
                    select: { title: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getWorkspaceLogs = async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const userId = req.user?.id;

    try {
        // Verify workspace membership
        const membership = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId,
                userId,
            }
        });

        if (!membership) {
            return res.status(403).json({ message: 'Not a member of this workspace' });
        }

        const logs = await prisma.auditLog.findMany({
            where: {
                task: {
                    project: {
                        workspaceId: workspaceId
                    }
                }
            },
            include: {
                user: {
                    select: { name: true, id: true }
                },
                task: {
                    select: { title: true, id: true, projectId: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getTaskLogs = async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params as { taskId: string };

    try {
        const logs = await prisma.auditLog.findMany({
            where: { taskId },
            include: {
                user: {
                    select: { id: true, name: true, avatarUrl: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const logActivity = async (
    userId: string,
    taskId: string,
    action: string,
    metadata?: Record<string, any>
) => {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                taskId,
                action,
                details: metadata ? JSON.stringify(metadata) : null,
            },
        });
    } catch (error: any) {
        console.error('Error logging activity:', error.message);
    }
};

export const deleteProjectLogs = async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const userId = req.user?.id;

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { workspaceId: true }
        });

        if (!project) return res.status(404).json({ message: 'Project not found' });

        const membership = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: userId! } }
        });

        if (membership?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Only admins can clear activity logs' });
        }

        await prisma.auditLog.deleteMany({
            where: { task: { projectId } }
        });

        res.json({ message: 'Project logs cleared' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteWorkspaceLogs = async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const userId = req.user?.id;

    try {
        const membership = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: userId! } }
        });

        if (membership?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Only admins can clear activity logs' });
        }

        await prisma.auditLog.deleteMany({
            where: { task: { project: { workspaceId } } }
        });

        res.json({ message: 'Workspace logs cleared' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
