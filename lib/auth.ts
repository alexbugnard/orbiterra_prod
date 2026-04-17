import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string
        const password = credentials?.password as string

        console.log('[auth] email received:', email)
        console.log('[auth] ADMIN_EMAIL env:', process.env.ADMIN_EMAIL)
        console.log('[auth] password length:', password?.length)
        console.log('[auth] hash value:', process.env.ADMIN_PASSWORD_HASH)

        if (!email || !password) return null
        if (email !== process.env.ADMIN_EMAIL) return null

        const valid = await compare(password, process.env.ADMIN_PASSWORD_HASH!)
        console.log('[auth] bcrypt valid:', valid)
        if (!valid) return null

        return { id: '1', email }
      },
    }),
  ],
  pages: { signIn: '/admin/login' },
  session: { strategy: 'jwt' },
})
