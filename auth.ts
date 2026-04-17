import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId = process.env.AUTH_GOOGLE_ID ?? "";
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? "";

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  pages: {
    signIn: "/login",
  },
};
