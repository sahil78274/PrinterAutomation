import Badge from '../ui/Badge.jsx';
import { MACHINE_STATUS_META, ORDER_STATUS_META } from '../../lib/constants.js';

export function OrderStatusBadge({ status, size = 'md' }) {
  const meta = ORDER_STATUS_META[status] ?? ORDER_STATUS_META.queued;
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  );
}

export function MachineStatusBadge({ status, size = 'md' }) {
  const meta = MACHINE_STATUS_META[status] ?? MACHINE_STATUS_META.offline;
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  );
}
