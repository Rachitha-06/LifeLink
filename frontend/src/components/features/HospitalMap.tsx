import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useHospitalMap } from '@/hooks/useAnalytics';

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

function markerColor(criticalCount: number, verified: boolean) {
  if (!verified) return '#6b7280'; // brand-gray — unverified, deprioritized visually
  if (criticalCount > 0) return '#c0392b'; // brand-red
  return '#0d7377'; // brand-teal
}

/**
 * Uses CircleMarker (a plain SVG circle) rather than Leaflet's default
 * pin icon — deliberately sidesteps the well-known Leaflet+Vite bundler
 * issue where the default marker icon's image paths break after
 * bundling. Also lets marker size encode pending-request volume, which
 * a fixed pin icon couldn't do.
 */
export function HospitalMap() {
  const { data, isLoading } = useHospitalMap();

  if (isLoading) {
    return (
      <Card>
        <Skeleton className="h-96 w-full" />
      </Card>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-brand shadow-brand" style={{ height: 420 }}>
        <MapContainer center={INDIA_CENTER} zoom={5} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {data?.hospitals.map((h) => (
            <CircleMarker
              key={h.hospital_id}
              center={[h.latitude, h.longitude]}
              radius={Math.max(6, Math.min(20, 6 + h.pending_requests * 2))}
              pathOptions={{
                color: markerColor(h.critical_requests, h.verified_status),
                fillColor: markerColor(h.critical_requests, h.verified_status),
                fillOpacity: 0.6,
              }}
            >
              <Popup>
                <strong>{h.name}</strong>
                <br />
                {h.city}
                <br />
                {h.pending_requests} pending request{h.pending_requests === 1 ? '' : 's'}
                {h.critical_requests > 0 && (
                  <>
                    <br />
                    <span style={{ color: '#c0392b' }}>{h.critical_requests} critical</span>
                  </>
                )}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {data && data.unassigned_requests > 0 && (
        <p className="mt-2 text-xs text-brand-gray">
          {data.unassigned_requests} pending request{data.unassigned_requests === 1 ? '' : 's'} not yet
          assigned to a hospital — not shown on the map.
        </p>
      )}
    </div>
  );
}
