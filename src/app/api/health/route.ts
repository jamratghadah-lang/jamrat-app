// Health check endpoint.
//
// GET /api/health — public (no auth). Returns the overall system status
// + individual component checks (DB, integrations). Used by:
//   - Load balancers / Docker healthchecks
//   - Uptime monitors (UptimeRobot, Pingdom)
//   - Kubernetes liveness/readiness probes
//
// The endpoint is deliberately lightweight — it doesn't run any
// expensive queries or external API calls. The DB check is a simple
// `SELECT 1` via Prisma's `$queryRaw`. Integration checks just verify
// the config row exists, not that the external service is reachable.
//
// Response shape:
//   {
//     status: "healthy" | "degraded" | "unhealthy",
//     timestamp: ISO string,
//     version: string,
//     checks: {
//       database: { status: "up" | "down", latencyMs: number },
//       integrations: { status: "configured" | "not_configured", count: number },
//     }
//   }
//
// Status semantics:
//   - "healthy": all checks pass (DB up, no critical issues).
//   - "degraded": DB is up but some integrations not configured (the
//     app still works, just some features unavailable).
//   - "unhealthy": DB is down (the app cannot serve requests).

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic' // never cache health checks

interface HealthCheck {
  status: 'up' | 'down' | 'configured' | 'not_configured'
  latencyMs?: number
  error?: string
  count?: number
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: HealthCheck
    integrations: HealthCheck
  }
}

const APP_VERSION = '11.2.0'
const START_TIME = Date.now()

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now()
  try {
    // Lightweight DB connectivity check. `SELECT 1` is the canonical
    // "is the DB up?" probe — it doesn't touch any table, just verifies
    // the connection works.
    await db.$queryRaw`SELECT 1`
    return { status: 'up', latencyMs: Date.now() - start }
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message.slice(0, 200) : 'unknown error',
    }
  }
}

async function checkIntegrations(): Promise<HealthCheck> {
  try {
    const count = await db.integrationConfig.count()
    if (count === 0) {
      return { status: 'not_configured', count: 0 }
    }
    return { status: 'configured', count }
  } catch {
    // If we can't read integration_configs, the DB check will already
    // report "down". Don't double-report.
    return { status: 'not_configured' }
  }
}

export async function GET() {
  try {
    const [dbCheck, integrationsCheck] = await Promise.all([
      checkDatabase(),
      checkIntegrations(),
    ])

    let overall: HealthResponse['status'] = 'healthy'
    if (dbCheck.status === 'down') {
      overall = 'unhealthy'
    } else if (integrationsCheck.status === 'not_configured') {
      overall = 'degraded'
    }

    const body: HealthResponse = {
      status: overall,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      checks: {
        database: dbCheck,
        integrations: integrationsCheck,
      },
    }

    // 503 for unhealthy so load balancers can pull the instance out
    // of rotation. 200 for healthy + degraded (degraded still serves
    // requests, just with reduced functionality).
    const status = overall === 'unhealthy' ? 503 : 200
    return NextResponse.json(body, { status })
  } catch (error) {
    // If the health check itself throws (e.g. db.$queryRaw crashed),
    // return 503 with the error.
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: APP_VERSION,
        error: error instanceof Error ? error.message.slice(0, 200) : 'unknown error',
      },
      { status: 503 },
    )
  }
}
