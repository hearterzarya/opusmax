import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

function getJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET
  const secret = typeof raw === 'string' ? raw.trim() : ''

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set (and non-empty) in production')
    }
    return new TextEncoder().encode('dev-only-secret-change-in-production')
  }

  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production')
  }

  return new TextEncoder().encode(secret)
}

export interface AdminSession {
  id: string
  email: string
  name: string | null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createAdminToken(admin: AdminSession): Promise<string> {
  const jwtSecret = getJwtSecret()
  return new SignJWT({ ...admin })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(jwtSecret)
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const jwtSecret = getJwtSecret()
    const { payload } = await jwtVerify(token, jwtSecret)
    const id = typeof payload.id === 'string' ? payload.id : ''
    const email = typeof payload.email === 'string' ? payload.email : ''
    const name =
      payload.name === null || typeof payload.name === 'string' ? payload.name : null

    if (!id || !email) return null
    return { id, email, name }
  } catch {
    return null
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value

  if (!token) return null

  const session = await verifyAdminToken(token)
  if (!session) return null

  // Re-validate admin against DB so stale/deleted users cannot keep using
  // previously issued JWTs.
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true },
  })

  if (!admin) return null
  if (admin.email !== session.email) return null

  return { id: admin.id, email: admin.email, name: admin.name }
}

export async function setAdminCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })
}

export async function clearAdminCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('admin_token')
}

export async function loginAdmin(email: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const inputEmail = email.trim().toLowerCase()
  const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const envPassword = process.env.ADMIN_PASSWORD || ''

  const admin = await prisma.adminUser.findUnique({ where: { email: inputEmail } })

  // Env-based bootstrap/recovery path:
  // Disabled in production by default. It is intended for local/dev recovery.
  const allowEnvBootstrap =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_ENV_ADMIN_BOOTSTRAP === 'true'
  if (allowEnvBootstrap && envEmail && envPassword && inputEmail === envEmail && password === envPassword) {
    const passwordHash = await hashPassword(envPassword)
    const ensured = await prisma.adminUser.upsert({
      where: { email: envEmail },
      update: { passwordHash },
      create: {
        email: envEmail,
        passwordHash,
        name: 'Admin',
      },
    })

    const token = await createAdminToken({
      id: ensured.id,
      email: ensured.email,
      name: ensured.name,
    })

    await setAdminCookie(token)
    return { success: true, token }
  }

  if (!admin) return { success: false, error: 'Invalid credentials' }

  const valid = await verifyPassword(password, admin.passwordHash)
  if (!valid) return { success: false, error: 'Invalid credentials' }

  const token = await createAdminToken({
    id: admin.id,
    email: admin.email,
    name: admin.name,
  })

  await setAdminCookie(token)

  return { success: true, token }
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminCookie()
}