import { PrismaClient, Role, Priority, TaskStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Starting database seeding...');

    // 0. Clean up existing data (Optional, but good for demo)
    console.log('🧹 Cleaning up old data...');
    await prisma.task.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.workspace.deleteMany({});

    // 1. Create Admin User
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@nexus.com' },
        update: { role: Role.ADMIN },
        create: {
            email: 'admin@nexus.com',
            name: 'Nexus Admin',
            password: adminPassword,
            role: Role.ADMIN,
        },
    });
    console.log('✅ Admin user ready:', admin.email);

    // 2. Create Workspace
    const workspace = await prisma.workspace.create({
        data: {
            name: 'Nexus Core Development',
            description: 'Main workspace for Nexus platform engineering and product design.',
            ownerId: admin.id,
            members: {
                create: {
                    userId: admin.id,
                    role: Role.ADMIN,
                },
            },
        },
    });
    console.log('✅ Workspace created:', workspace.name);

    // 3. Create Project
    const project = await prisma.project.create({
        data: {
            name: 'Nexus Web Interface',
            description: 'The next generation of collaboration interfaces.',
            workspaceId: workspace.id,
        },
    });
    console.log('✅ Project created:', project.name);

    // 4. Create Tasks
    console.log('📝 Seeding sample tasks...');
    const tasksData = [
        {
            title: 'Define Global Style Architecture',
            description: 'Establish the CSS variable foundation and glassmorphism rules.',
            status: TaskStatus.DONE,
            priority: Priority.HIGH,
            projectId: project.id,
            assigneeId: admin.id,
            creatorId: admin.id,
        },
        {
            title: 'Optimize Kanban Performance',
            description: 'Ensure smooth drag and drop with 100+ tasks.',
            status: TaskStatus.IN_PROGRESS,
            priority: Priority.URGENT,
            projectId: project.id,
            assigneeId: admin.id,
            creatorId: admin.id,
        },
        {
            title: 'Implement Dark Mode Sync',
            description: 'Link theme store with system preferences.',
            status: TaskStatus.IN_PROGRESS,
            priority: Priority.MEDIUM,
            projectId: project.id,
            creatorId: admin.id,
        },
        {
            title: 'Real-time Socket Integration',
            description: 'Sync task movements across multiple clients.',
            status: TaskStatus.TODO,
            priority: Priority.HIGH,
            projectId: project.id,
            creatorId: admin.id,
        },
        {
            title: 'Audit User Access Levels',
            description: 'Hardening the RBAC system across all endpoints.',
            status: TaskStatus.TODO,
            priority: Priority.LOW,
            projectId: project.id,
            creatorId: admin.id,
        }
    ];

    for (const task of tasksData) {
        await prisma.task.create({ data: task });
    }

    console.log('🌿 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
