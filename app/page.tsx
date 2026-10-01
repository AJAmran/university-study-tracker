import { getAppData } from '@/lib/db';
import { UniMasterApp } from '@/components/UniMasterApp';

// Revalidate on request to ensure latest mutations reflect immediately
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const data = await getAppData();

  return <UniMasterApp initialData={data} />;
}
