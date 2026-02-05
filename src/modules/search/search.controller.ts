import type { Response } from 'express';
import prisma from '../../config/db.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const search = async (req: AuthRequest, res: Response) => {
    const q = req.query.q as string;
    const workspaceId = req.query.workspaceId as string;

    if (!q || !workspaceId) return res.json({ tasks: [], projects: [] });

    try {
        const tasks = await prisma.task.findMany({
            where: {
                project: { workspaceId: workspaceId as string },
                OR: [
                    { title: { contains: q as string, mode: 'insensitive' } },
                    { description: { contains: q as string, mode: 'insensitive' } }
                ]
            },
            include: {
                project: {
                    select: { name: true }
                }
            },
            orderBy: [
                { isArchived: 'asc' },
                { createdAt: 'desc' }
            ] as any,
            take: 20
        });

        const projects = await prisma.project.findMany({
            where: {
                workspaceId: workspaceId as string,
                name: { contains: q as string, mode: 'insensitive' }
            },
            take: 5
        });

        res.json({ tasks, projects });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
