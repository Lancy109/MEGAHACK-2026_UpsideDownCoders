import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/api/sos(.*)',
  '/api/users(.*)',
  '/api/ai(.*)',
  '/api/sms(.*)',
  '/sms-sos(.*)',
  '/auth/login(.*)',
  '/auth/signup(.*)',
  '/api/socket(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
    // Redirect logic moved to client components to avoid sessionClaims missing metadata loop
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
