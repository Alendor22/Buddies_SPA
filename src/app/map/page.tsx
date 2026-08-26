import BuddiesSpatialMap from '@/components/map/runtime/BuddiesSpatialMap';

export const dynamic = 'force-dynamic';

export default function SpatialMapPage() {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950">
      <BuddiesSpatialMap />
    </div>
  );
}
