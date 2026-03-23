export const SEVERITY = {
  CRITICAL: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/15 text-red-400 border-red-500/30' },
  HIGH: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  LOW: { label: 'Low', color: 'text-blue-400', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  INFORMATIONAL: { label: 'Info', color: 'text-gray-400', bg: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

export const STATUS = {
  DRAFT: { label: 'Draft', bg: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  UNDER_REVIEW: { label: 'Under Review', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  EMBARGOED: { label: 'Embargoed', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  PUBLISHED: { label: 'Published', bg: 'bg-green-500/15 text-green-400 border-green-500/30' },
  DISPUTED: { label: 'Disputed', bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  DEPRECATED: { label: 'Deprecated', bg: 'bg-red-500/15 text-red-400 border-red-500/30' },
  REJECTED: { label: 'Rejected', bg: 'bg-red-700/15 text-red-500 border-red-700/30' },
}

export const ROLES = {
  ADMIN: { label: 'Admin', bg: 'bg-red-500/15 text-red-400 border-red-500/30' },
  CNA_MEMBER: { label: 'CNA Member', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  NATIONAL_BODY: { label: 'National Body', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  RESEARCHER: { label: 'Researcher', bg: 'bg-green-500/15 text-green-400 border-green-500/30' },
  PUBLIC: { label: 'Public', bg: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

export const PROPOSAL_TYPES = {
  POLICY_CHANGE: { label: 'Policy Change', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  CNA_MEMBERSHIP: { label: 'CNA Membership', bg: 'bg-green-500/15 text-green-400 border-green-500/30' },
  SEVERITY_THRESHOLD: { label: 'Severity Threshold', bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  EMBARGO_EXTENSION: { label: 'Embargo Extension', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
}

export const STATUS_TRANSITIONS = {
  DRAFT: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['EMBARGOED', 'PUBLISHED'],
  EMBARGOED: ['PUBLISHED'],
  PUBLISHED: ['DISPUTED'],
  DISPUTED: ['PUBLISHED'],
}

export const SUBMIT_ROLES = ['CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN', 'RESEARCHER']
export const TRANSITION_ROLES = ['CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN']
export const GOVERNANCE_ROLES = ['CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN']

export const CHART_COLORS = {
  severity: {
    CRITICAL: '#EF4444',
    HIGH: '#F97316',
    MEDIUM: '#EAB308',
    LOW: '#3B82F6',
    INFORMATIONAL: '#6B7280',
  },
  status: ['#6B7280', '#3B82F6', '#A855F7', '#22C55E', '#F97316', '#EF4444', '#991B1B'],
  trends: { total: '#00FF41', critical: '#EF4444', high: '#F97316' },
}

export const ORG_TO_MSP = {
  alpha: 'CNAAlphaMSP',
  beta: 'CNABetaMSP',
  regulator: 'RegulatorMSP',
}

export function getSeverityFromScore(score) {
  if (score >= 9.0) return 'CRITICAL'
  if (score >= 7.0) return 'HIGH'
  if (score >= 4.0) return 'MEDIUM'
  if (score >= 0.1) return 'LOW'
  return 'INFORMATIONAL'
}
