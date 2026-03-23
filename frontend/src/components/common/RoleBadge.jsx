import Badge from '../ui/Badge'
import { ROLES } from '../../lib/constants'

export default function RoleBadge({ role }) {
  const config = ROLES[role] || ROLES.PUBLIC
  return <Badge className={config.bg}>{config.label}</Badge>
}
