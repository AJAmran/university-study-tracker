import { getAppData } from '@/lib/db';
import { UniMasterApp } from '@/components/UniMasterApp';

// Revalidate on request to ensure latest mutations reflect immediately
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  try {
    const data = await getAppData();
    return <UniMasterApp initialData={data} />;
  } catch (error) {
    console.error('Failed to load app data:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Could not connect to the database</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Check your DATABASE_URL in .env.local and that Postgres is reachable, then reload.
          </p>
          <p className="mt-2 text-xs text-zinc-400 break-words">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }
}
