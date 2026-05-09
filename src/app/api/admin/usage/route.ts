import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Accept either an ISO datetime ("2026-05-08T12:30:00Z") or a plain date
// ("2026-05-08") — the latter is what <input type="date"> sends.
const dateLike = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: 'Invalid date',
  })
  .transform((v) => new Date(v))

// Strict-ish boolean parser. z.coerce.boolean() treats "false" as truthy.
const stringBool = z
  .union([z.boolean(), z.string()])
  .transform((v) => {
    if (typeof v === 'boolean') return v
    return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
  })

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  apiKeyId: z.string().optional(),
  model: z.string().optional(),
  dateFrom: dateLike.optional(),
  dateTo: dateLike.optional(),
  errorOnly: stringBool.optional(),
  export: z.enum(['csv']).optional(),
})

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const params = querySchema.parse(Object.fromEntries(searchParams))

    const where: Record<string, unknown> = {}

    if (params.apiKeyId) where.apiKeyId = params.apiKeyId
    if (params.model) where.model = params.model

    if (params.dateFrom || params.dateTo) {
      const range: Record<string, Date> = {}
      if (params.dateFrom) range.gte = params.dateFrom
      if (params.dateTo) {
        // For date-only inputs, include the entire day by pushing to end-of-day.
        const to = params.dateTo
        const isDateOnly =
          to.getUTCHours() === 0 &&
          to.getUTCMinutes() === 0 &&
          to.getUTCSeconds() === 0
        range.lte = isDateOnly
          ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1)
          : to
      }
      where.timestamp = range
    }

    if (params.errorOnly) {
      where.statusCode = { gte: 400 }
    }

    if (params.export === 'csv') {
      // CSV export must NOT honour pagination — give all matching rows.
      const exportLogs = await prisma.usageLog.findMany({
        where,
        include: { apiKey: { select: { id: true, name: true, keyPrefix: true } } },
        orderBy: { timestamp: 'desc' },
        take: 10_000, // safety ceiling
      })

      const header = [
        'ID',
        'Key Name',
        'Key Prefix',
        'Model',
        'Input Tokens',
        'Output Tokens',
        'Total Tokens',
        'Latency (ms)',
        'Status Code',
        'Error Type',
        'Timestamp',
      ].join(',')

      const rows = exportLogs.map((log) =>
        [
          log.id,
          log.apiKey.name,
          log.apiKey.keyPrefix,
          log.model,
          log.inputTokens,
          log.outputTokens,
          log.totalTokens,
          log.latencyMs,
          log.statusCode,
          log.errorType ?? '',
          log.timestamp.toISOString(),
        ]
          .map(csvEscape)
          .join(',')
      )

      return new NextResponse([header, ...rows].join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="usage-logs.csv"',
        },
      })
    }

    const total = await prisma.usageLog.count({ where })

    const logs = await prisma.usageLog.findMany({
      where,
      include: {
        apiKey: { select: { id: true, name: true, keyPrefix: true } },
      },
      orderBy: { timestamp: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    })

    return NextResponse.json({
      logs,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid query parameters' } },
        { status: 400 }
      )
    }

    console.error('Error fetching usage logs:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}
