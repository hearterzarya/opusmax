import { PrismaClient, PlanTier } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const adminPassword = process.env.ADMIN_PASSWORD || 'OpusX-Admin-2026!'
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@opusx.gateway'

  const hashedPassword = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      name: 'OpusX Admin',
    },
  })
  console.log(`Created admin user: ${admin.email}`)

  // Create default plans with specific values
  const plans = [
    {
      name: 'Free',
      tier: PlanTier.FREE,
      tokenLimitMonthly: 100000n,
      rpmLimit: 60,
      hourlyTokenBudget: 20000n,
      priceMonthly: 0,
      description: 'Perfect for testing and small projects',
      features: ['100K tokens/month', '60 RPM', '5-hour rolling window', 'Basic support'],
    },
    {
      name: 'Starter',
      tier: PlanTier.STARTER,
      tokenLimitMonthly: 500000n,
      rpmLimit: 120,
      hourlyTokenBudget: 50000n,
      priceMonthly: 9,
      description: 'For developers and small teams',
      features: ['500K tokens/month', '120 RPM', '5-hour rolling window', 'Priority support'],
    },
    {
      name: 'Pro',
      tier: PlanTier.PRO,
      tokenLimitMonthly: 2000000n,
      rpmLimit: 300,
      hourlyTokenBudget: 200000n,
      priceMonthly: 29,
      description: 'For professional developers and businesses',
      features: ['2M tokens/month', '300 RPM', '5-hour rolling window', 'Dedicated support', 'Advanced analytics'],
    },
    {
      name: 'Enterprise',
      tier: PlanTier.ENTERPRISE,
      tokenLimitMonthly: 10000000n,
      rpmLimit: 1000,
      hourlyTokenBudget: 1000000n,
      priceMonthly: 199,
      description: 'For large organizations with high volume needs',
      features: ['10M tokens/month', '1000 RPM', '5-hour rolling window', '24/7 support', 'Custom limits', 'Dedicated account manager'],
    },
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        tier: plan.tier,
        tokenLimitMonthly: plan.tokenLimitMonthly,
        rpmLimit: plan.rpmLimit,
        hourlyTokenBudget: plan.hourlyTokenBudget,
        priceMonthly: plan.priceMonthly,
        description: plan.description,
        features: plan.features,
      },
      create: plan,
    })
    console.log(`Upserted plan: ${plan.name}`)
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })