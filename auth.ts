import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId = process.env.AUTH_GOOGLE_ID ?? "";
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? "";

// Backstage owner. The session callback stamps `isAdmin` so client components
// (e.g. the avatar menu) can show the Backstage entry without shipping the
// admin e-mail in the bundle.
const adminEmail = (process.env.ADMIN_EMAIL ?? "bartek.kwasnica.2005@gmail.com").toLowerCase();

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session({ session }) {
      const email = session.user?.email?.toLowerCase() ?? null;
      return { ...session, isAdmin: email !== null && email === adminEmail };
    },
  },
};
