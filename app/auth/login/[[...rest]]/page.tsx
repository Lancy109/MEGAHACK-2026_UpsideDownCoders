import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          ResQ<span className="text-red-600">Net</span>
        </h1>
        <p className="text-slate-500 font-medium mt-2">Sign in to your account</p>
      </div>
      <SignIn />
    </div>
  );
}
