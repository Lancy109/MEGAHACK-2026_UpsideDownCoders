import ResourceMap from '@/components/ResourceMap';

export const metadata = { title: 'Resource Map — ResQNet' };

export default function ResourceMapPage() {
  return (
    <main className="h-[calc(100vh-4rem)] overflow-hidden">
      <ResourceMap />
    </main>
  );
}
