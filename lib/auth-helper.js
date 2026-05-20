import { getServerSession } from 'next-auth'
import { authOptions } from './auth-options'

export async function getCurrentUserId() {
  const session = await getServerSession(authOptions)
  return session?.user?.id || null
}

export async function getCurrentSession() {
  return await getServerSession(authOptions)
}
