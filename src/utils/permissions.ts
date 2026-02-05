import prisma from '../config/db.js';

export const checkWorkspaceAdmin = async (userId: string, workspaceId: string): Promise<boolean> => {
    const member = await prisma.workspaceMember.findUnique({
        where: {
            workspaceId_userId: {
                workspaceId,
                userId
            }
        }
    });
    return member?.role === 'ADMIN';
};

export const getProjectWorkspaceId = async (projectId: string): Promise<string | null> => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspaceId: true }
    });
    return project?.workspaceId || null;
};
