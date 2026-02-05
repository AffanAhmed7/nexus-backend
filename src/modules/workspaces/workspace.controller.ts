import type { Request, Response } from 'express';
import prisma from '../../config/db.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { io } from '../../index.js';

export const createWorkspace = async (req: AuthRequest, res: Response) => {
    const { name, description } = req.body;
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const workspace = await (prisma as any).workspace.create({
            data: {
                name,
                description,
                ownerId: userId,
                members: {
                    create: {
                        userId,
                        role: 'ADMIN',
                        status: 'ACCEPTED'
                    }
                }
            },
            include: {
                members: true,
            }
        });
        res.status(201).json(workspace);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getWorkspaces = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const workspaces = await (prisma as any).workspace.findMany({
            where: {
                members: {
                    some: {
                        userId,
                        status: 'ACCEPTED'
                    }
                }
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true,
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        members: true,
                        projects: true,
                    }
                }
            }
        });

        res.json(workspaces);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getWorkspaceById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as { id: string };
    const userId = req.user?.id;

    try {
        const workspace = await (prisma as any).workspace.findFirst({
            where: {
                id,
                members: {
                    some: {
                        userId,
                        status: 'ACCEPTED'
                    }
                }
            },
            include: {
                projects: true,
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true,
                            }
                        }
                    }
                }
            }
        });

        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        res.json(workspace);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const inviteUser = async (req: AuthRequest, res: Response) => {
    const { workspaceId, email, role } = req.body;
    const adminId = req.user?.id;

    try {
        // Check if requester is admin/owner
        const member = await prisma.workspaceMember.findFirst({
            where: { workspaceId, userId: adminId, role: 'ADMIN' }
        });

        if (!member) {
            return res.status(403).json({ message: 'Only admins can invite members' });
        }

        const userToInvite = await prisma.user.findUnique({ where: { email } });
        if (!userToInvite) {
            return res.status(404).json({ message: 'User not found' });
        }

        const existingMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: userToInvite.id } }
        });

        if (existingMember) {
            return res.status(400).json({ message: 'User is already a member or invited' });
        }

        const newMember: any = await (prisma as any).workspaceMember.create({
            data: {
                workspaceId,
                userId: userToInvite.id,
                role: role || 'MEMBER',
                status: 'PENDING'
            },
            include: { workspace: true }
        });

        // Create Notification
        const notification = await prisma.notification.create({
            data: {
                userId: userToInvite.id,
                type: 'INVITATION',
                title: 'Workspace Invitation',
                message: `You have been invited to join ${newMember.workspace.name}`,
                link: `/dashboard?workspaceId=${workspaceId}`
            }
        });

        // Emit real-time notification
        io.to(`user_${userToInvite.id}`).emit('notification', notification);

        res.json({ message: 'Invitation sent', member: newMember });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const respondToInvitation = async (req: AuthRequest, res: Response) => {
    const { workspaceId, accept } = req.body;
    const userId = req.user?.id;

    try {
        if (accept) {
            await (prisma as any).workspaceMember.update({
                where: { workspaceId_userId: { workspaceId, userId: userId! } },
                data: { status: 'ACCEPTED' }
            });

            // Emit real-time workspace list update
            io.to(`user_${userId}`).emit('workspace_list_updated');

            res.json({ message: 'Invitation accepted' });
        } else {
            await prisma.workspaceMember.delete({
                where: { workspaceId_userId: { workspaceId, userId: userId! } }
            });
            res.json({ message: 'Invitation declined' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
    const { workspaceId, userId, role } = req.body;
    const adminId = req.user?.id;

    try {
        const adminMember = await prisma.workspaceMember.findFirst({
            where: { workspaceId, userId: adminId, role: 'ADMIN' }
        });

        if (!adminMember) {
            return res.status(403).json({ message: 'Only admins can update roles' });
        }

        const updatedMember = await prisma.workspaceMember.update({
            where: { workspaceId_userId: { workspaceId, userId } },
            data: { role }
        });

        res.json(updatedMember);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
    const { workspaceId, userId } = req.body;
    const adminId = req.user?.id;

    try {
        const adminMember = await prisma.workspaceMember.findFirst({
            where: { workspaceId, userId: adminId, role: 'ADMIN' }
        });

        if (!adminMember) {
            return res.status(403).json({ message: 'Only admins can remove members' });
        }

        await prisma.workspaceMember.delete({
            where: { workspaceId_userId: { workspaceId, userId } }
        });

        // Emit kicked event for real-time redirection
        io.to(`user_${userId}`).emit('kicked_from_workspace', { workspaceId });

        res.json({ message: 'Member removed successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteWorkspace = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as { id: string };
    const userId = req.user?.id;

    try {
        const workspace = await prisma.workspace.findUnique({
            where: { id }
        });

        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
        if (workspace.ownerId !== userId) {
            return res.status(403).json({ message: 'Only the owner can delete the workspace' });
        }

        await prisma.workspace.delete({ where: { id } });

        // Emit workspace_deleted to all members
        io.to(`workspace_${id}`).emit('workspace_deleted', { workspaceId: id });

        res.json({ message: 'Workspace deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
