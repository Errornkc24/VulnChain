package main

// CVERecord represents a CVE vulnerability record stored on the blockchain
type CVERecord struct {
	DocType          string         `json:"docType"`
	CVEID            string         `json:"cveId"`
	Title            string         `json:"title"`
	Description      string         `json:"description"`
	AffectedProduct  string         `json:"affectedProduct"`
	AffectedVersions []string       `json:"affectedVersions"`
	CPEIdentifiers   []string       `json:"cpeIdentifiers"`
	CVSSScore        float64        `json:"cvssScore"`
	CVSSVector       string         `json:"cvssVector"`
	Severity         string         `json:"severity"`
	CWEId            string         `json:"cweId"`
	CWEDescription   string         `json:"cweDescription"`
	Status           string         `json:"status"`
	SubmitterOrg     string         `json:"submitterOrg"`
	SubmitterUser    string         `json:"submitterUser"`
	OwnerOrg         string         `json:"ownerOrg"`
	EmbargoDate      string         `json:"embargoDate"`
	PatchInfo        string         `json:"patchInfo"`
	References       []string       `json:"references"`
	History          []HistoryEntry `json:"history"`
	CreatedAt        string         `json:"createdAt"`
	UpdatedAt        string         `json:"updatedAt"`
}

// HistoryEntry records a single change event in a CVE's lifecycle
type HistoryEntry struct {
	Action    string `json:"action"`
	Actor     string `json:"actor"`
	ActorOrg  string `json:"actorOrg"`
	Timestamp string `json:"timestamp"`
	Notes     string `json:"notes"`
	OldValue  string `json:"oldValue"`
	NewValue  string `json:"newValue"`
}

// Proposal represents a governance proposal for DAO-style voting
type Proposal struct {
	DocType      string          `json:"docType"`
	ProposalID   string          `json:"proposalId"`
	Title        string          `json:"title"`
	Description  string          `json:"description"`
	Type         string          `json:"type"`
	ProposerOrg  string          `json:"proposerOrg"`
	ProposerUser string          `json:"proposerUser"`
	Status       string          `json:"status"`
	Votes        map[string]Vote `json:"votes"`
	Quorum       int             `json:"quorum"`
	Threshold    int             `json:"threshold"`
	Metadata     *ProposalMetadata `json:"metadata,omitempty"`
	CreatedAt    string            `json:"createdAt"`
	ExpiresAt    string            `json:"expiresAt"`
	EnactedAt    string            `json:"enactedAt"`
}

// Vote represents a single organization's vote on a proposal
type Vote struct {
	VoterOrg  string `json:"voterOrg"`
	VoterUser string `json:"voterUser"`
	Decision  string `json:"decision"`
	Weight    int    `json:"weight"`
	Timestamp string `json:"timestamp"`
	Reason    string `json:"reason"`
}

// CVECounter tracks the next available CVE ID number
type CVECounter struct {
	DocType string `json:"docType"`
	Year    int    `json:"year"`
	Counter int    `json:"counter"`
}

// ProposalCounter tracks the next available proposal ID number
type ProposalCounter struct {
	DocType string `json:"docType"`
	Counter int    `json:"counter"`
}

// CVECountByStatus holds count statistics per status
type CVECountByStatus struct {
	Draft       int `json:"draft"`
	UnderReview int `json:"underReview"`
	Embargoed   int `json:"embargoed"`
	Published   int `json:"published"`
	Disputed    int `json:"disputed"`
	Deprecated  int `json:"deprecated"`
	Rejected    int `json:"rejected"`
	Total       int `json:"total"`
}

// PublicCVEView is a limited view of embargoed CVEs for public users
type PublicCVEView struct {
	DocType         string `json:"docType"`
	CVEID           string `json:"cveId"`
	AffectedProduct string `json:"affectedProduct"`
	EmbargoDate     string `json:"embargoDate"`
	Status          string `json:"status"`
}

// QueryFilter holds rich query parameters
type QueryFilter struct {
	Status   string `json:"status,omitempty"`
	Severity string `json:"severity,omitempty"`
	Product  string `json:"product,omitempty"`
	FromDate string `json:"fromDate,omitempty"`
	ToDate   string `json:"toDate,omitempty"`
}

// CVE Status constants
const (
	StatusDraft       = "DRAFT"
	StatusUnderReview = "UNDER_REVIEW"
	StatusEmbargoed   = "EMBARGOED"
	StatusPublished   = "PUBLISHED"
	StatusDisputed    = "DISPUTED"
	StatusDeprecated  = "DEPRECATED"
	StatusRejected    = "REJECTED"
)

// Severity constants
const (
	SeverityCritical      = "CRITICAL"
	SeverityHigh          = "HIGH"
	SeverityMedium        = "MEDIUM"
	SeverityLow           = "LOW"
	SeverityInformational = "INFORMATIONAL"
)

// Proposal Status constants
const (
	ProposalStatusProposed = "PROPOSED"
	ProposalStatusActive   = "ACTIVE"
	ProposalStatusPassed   = "PASSED"
	ProposalStatusRejected = "REJECTED"
	ProposalStatusEnacted  = "ENACTED"
)

// Proposal Type constants
const (
	ProposalTypePolicyChange      = "POLICY_CHANGE"
	ProposalTypeCNAMembership     = "CNA_MEMBERSHIP"
	ProposalTypeSeverityThreshold = "SEVERITY_THRESHOLD"
	ProposalTypeEmbargoExtension  = "EMBARGO_EXTENSION"
)

// Vote Decision constants
const (
	VoteYes     = "YES"
	VoteNo      = "NO"
	VoteAbstain = "ABSTAIN"
)

// History Action constants
const (
	ActionCreated      = "CREATED"
	ActionUpdated      = "UPDATED"
	ActionStatusChange = "STATUS_CHANGE"
	ActionEmbargoSet   = "EMBARGO_SET"
)

// Default organization role weights (used as fallback during bootstrap)
var DefaultOrgWeights = map[string]int{
	"CNAAlphaMSP":  1,
	"CNABetaMSP":   1,
	"RegulatorMSP": 3,
}

// Organization represents a consortium member registered on the ledger
type Organization struct {
	DocType      string `json:"docType"`
	MSPID        string `json:"mspId"`
	Name         string `json:"name"`
	OrgType      string `json:"orgType"` // CNA, NATIONAL_BODY, RESEARCHER
	Status       string `json:"status"`  // PENDING, ACTIVE, SUSPENDED, REVOKED
	VoteWeight   int    `json:"voteWeight"`
	PeerEndpoint string `json:"peerEndpoint,omitempty"`
	Description  string `json:"description,omitempty"`
	ProposalID   string `json:"proposalId,omitempty"` // the governance proposal that admitted this org
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

// Organization Status constants
const (
	OrgStatusPending   = "PENDING"
	OrgStatusActive    = "ACTIVE"
	OrgStatusSuspended = "SUSPENDED"
	OrgStatusRevoked   = "REVOKED"
)

// Organization Type constants
const (
	OrgTypeCNA          = "CNA"
	OrgTypeNationalBody = "NATIONAL_BODY"
	OrgTypeResearcher   = "RESEARCHER"
)

// ProposalMetadata holds extra data for specific proposal types (e.g. CNA_MEMBERSHIP)
type ProposalMetadata struct {
	OrgMSPID     string `json:"orgMspId,omitempty"`
	OrgName      string `json:"orgName,omitempty"`
	OrgType      string `json:"orgType,omitempty"`
	VoteWeight   int    `json:"voteWeight,omitempty"`
	PeerEndpoint string `json:"peerEndpoint,omitempty"`
}

// Private data collection name
const EmbargoCollection = "embargoedCVECollection"
