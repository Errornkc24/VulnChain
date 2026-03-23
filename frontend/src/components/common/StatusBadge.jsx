import Badge from '../ui/Badge'
import { STATUS } from '../../lib/constants'

export default function StatusBadge({ status }) {
  const config = STATUS[status] || STATUS.DRAFT
  return <Badge className={config.bg}>{config.label}</Badge>
}
