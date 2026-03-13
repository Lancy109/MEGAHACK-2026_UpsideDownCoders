'use client';

import { useUser, SignOutButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const ROLES = [
  { 
    id: 'VICTIM', 
    icon: '🆘', 
    title: 'I Need Help', 
    desc: 'Post an SOS alert and get immediate assistance.',
    color: 'bg-red-50 text-red-700 border-red-200 hover:border-red-400 hover:shadow-red-500/10'
  },
  { 
    id: 'VOLUNTEER', 
    icon: '🫂', 
    title: 'I Am a Volunteer', 
    desc: 'View live alerts and assist people in your local area.',
    color: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400 hover:shadow-blue-500/10'
  },
  { 
    id: 'NGO', 
    icon: '🏢', 
    title: 'I am an NGO', 
    desc: 'Coordinate large-scale relief and track analytics.',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:border-yellow-400 hover:shadow-yellow-500/10'
  }
];

export default function UserTypePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // No automatic redirect here anymore.
  // If they land on this page, we WANT them to pick a role to ensure DB sync,
  // especially after a database nuke.
  
  async function handleSelection(roleId: string) {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: user?.id,
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'ResQNet User',
          email: user?.emailAddresses[0]?.emailAddress || '',
          phone: user?.primaryPhoneNumber?.phoneNumber || 'No phone provided',
          role: roleId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync account');

      // Update Clerk session to reflect the new role
      await user?.reload();
      
      router.replace(roleId === 'VICTIM' ? '/victim' : roleId === 'VOLUNTEER' ? '/volunteer' : '/ngo');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">Finalizing Setup...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Welcome to ResQ<span className="text-red-600">Net</span>
          </h1>
          <p className="text-slate-500 text-lg font-medium">To get started, please select how you will use the platform.</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-100 text-red-700 rounded-2xl border border-red-200 text-center font-bold">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => handleSelection(role.id)}
              className={`group relative flex flex-col items-center text-center p-8 rounded-3xl border-2 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl ${role.color}`}
            >
              <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform duration-300">
                {role.icon}
              </div>
              <h3 className="text-2xl font-black mb-3">{role.title}</h3>
              <p className="text-sm opacity-80 leading-relaxed">{role.desc}</p>
              <div className="mt-8 px-6 py-2 bg-white/50 rounded-full text-xs font-bold uppercase tracking-wider group-hover:bg-white transition-colors duration-300">
                Select This Role
              </div>
            </button>
          ))}
        </div>

        <div className="mt-12 text-center">
            <SignOutButton>
                <button className="text-slate-400 hover:text-slate-600 font-medium transition-colors">
                    Not ready? Sign out and come back later.
                </button>
            </SignOutButton>
        </div>
      </div>
    </div>
  );
}
