import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Public routes that don't require authentication
    const publicRoutes = ["/", "/register"];
    
    // If user is on a public route and is authenticated, redirect to dashboard
    if (publicRoutes.includes(pathname) && token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // If user is not authenticated and trying to access protected routes
    if (!token && (pathname.startsWith("/dashboard") || pathname.startsWith("/api"))) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Allow access to protected routes for authenticated users
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Public routes are always accessible
        if (pathname === "/" || pathname === "/register") {
          return true;
        }
        
        // Protected routes require authentication
        if (pathname.startsWith("/dashboard")) {
          return !!token;
        }
        
        // Default to allowing access (you can change this to false for stricter security)
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
