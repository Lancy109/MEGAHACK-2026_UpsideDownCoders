'use client';
import { SignUp, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SignUpPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && user) {
      const role = user.publicMetadata?.role;
      if (role === 'VICTIM')    router.replace('/victim');
      if (role === 'VOLUNTEER') router.replace('/volunteer');
      if (role === 'NGO')       router.replace('/ngo');
      if (!role)                router.replace('/user-type');
    }
  }, [isLoaded, user, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          ResQ<span className="text-red-600">Net</span>
        </h1>
        <p className="text-slate-500 font-medium mt-2">Create your account to get started</p>
      </div>
      <SignUp />
    </div>
  );
}
