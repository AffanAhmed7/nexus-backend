
import { createProject } from './modules/projects/project.controller.js';
import prisma from './config/db.js';
import { Role } from '@prisma/client';

// Mock Request and Response
const mockRes = {
    status: (code: number) => ({
        json: (data: any) => console.log(`Response [${code}]:`, data)
    }),
    json: (data: any) => console.log('Response [200]:', data)
};

async function main() {
    console.log('🧪 Testing Project Controller directly...');

    try {
        // 1. Setup Data
        const adminEmail = 'admin@nexus.com';
        const user = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (!user) throw new Error('Admin not found');

        const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } });
        if (!workspace) throw new Error('Workspace not found');

        const req = {
            user: { id: user.id },
            body: {
                name: 'Controller Test Project',
                description: 'Testing circular dependency',
                workspaceId: workspace.id
            }
        };

        console.log('🚀 Calling createProject controller...');
        await createProject(req as any, mockRes as any);
        console.log('✅ Controller execution finished.');

    } catch (error) {
        console.error('❌ Controller crashed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
