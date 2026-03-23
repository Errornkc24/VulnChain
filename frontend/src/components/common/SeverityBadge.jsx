import Badge from '../ui/Badge'
import { SEVERITY } from '../../lib/constants'

export default function SeverityBadge({ severity }) {
  const config = SEVERITY[severity] || SEVERITY.INFORMATIONAL
  return <Badge className={config.bg}>{config.label}</Badge>
}
