import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.upsert({
        where: { email: 'demo@vibevaults.app' },
        update: {},
        create: {
            email: 'demo@vibevaults.app',
            password: 'demo', // Plaintext for MVP
            projects: {
                create: {
                    name: 'Demo Project',
                    domain: 'localhost',
                    apiKey: 'demo-api-key'
                }
            }
        },
    })
    console.log({ user })
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
