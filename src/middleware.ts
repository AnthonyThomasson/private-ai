import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const existingUserToken = req.cookies.get("user_token")?.value;

  if (!existingUserToken) {
    const newUserToken = uuidv4();
    res.cookies.set("user_token", newUserToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)"],
};
