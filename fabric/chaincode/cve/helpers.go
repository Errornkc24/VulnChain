package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// getClientMSPID returns the MSP ID of the calling client
func getClientMSPID(ctx contractapi.TransactionContextInterface) (string, error) {
	return ctx.GetClientIdentity().GetMSPID()
}

// getClientID returns a unique identifier for the calling client
func getClientID(ctx contractapi.TransactionContextInterface) (string, error) {
	id, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get client ID: %v", err)
	}
	return id, nil
}

// isCNAOrg checks if the MSP ID belongs to a CNA organization
func isCNAOrg(mspID string) bool {
	return strings.Contains(mspID, "CNA") || strings.Contains(mspID, "cna")
}

// isNationalBodyOrg checks if the MSP ID belongs to a national body or regulator
func isNationalBodyOrg(mspID string) bool {
	return strings.Contains(mspID, "Regulator") || strings.Contains(mspID, "NationalBody") ||
		strings.Contains(mspID, "regulator") || strings.Contains(mspID, "nationalbody")
}

// isConsortiumMember checks if the caller is a CNA or national body
func isConsortiumMember(mspID string) bool {
	return isCNAOrg(mspID) || isNationalBodyOrg(mspID)
}

// canWriteCVE checks if the MSP ID has write permission for CVEs
func canWriteCVE(mspID string) bool {
	return isCNAOrg(mspID) || isNationalBodyOrg(mspID)
}

// canReadEmbargoed checks if the MSP ID can read embargoed CVEs
func canReadEmbargoed(mspID string) bool {
	return isConsortiumMember(mspID)
}

// getVoteWeight returns the governance voting weight for an organization (static fallback)
func getVoteWeight(mspID string) int {
	if weight, ok := DefaultOrgWeights[mspID]; ok {
		return weight
	}
	if isNationalBodyOrg(mspID) {
		return 3
	}
	if isCNAOrg(mspID) {
		return 1
	}
	return 0
}

// getVoteWeightFromLedger reads the org's weight from the ledger, falls back to static
func getVoteWeightFromLedger(ctx contractapi.TransactionContextInterface, mspID string) int {
	orgKey := "ORG_" + mspID
	orgBytes, err := ctx.GetStub().GetState(orgKey)
	if err == nil && orgBytes != nil {
		var org Organization
		if json.Unmarshal(orgBytes, &org) == nil && org.Status == OrgStatusActive {
			return org.VoteWeight
		}
	}
	return getVoteWeight(mspID)
}

// getOrganization reads an organization record from the ledger
func getOrganization(ctx contractapi.TransactionContextInterface, mspID string) (*Organization, error) {
	orgKey := "ORG_" + mspID
	orgBytes, err := ctx.GetStub().GetState(orgKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read organization: %v", err)
	}
	if orgBytes == nil {
		return nil, nil
	}
	var org Organization
	if err := json.Unmarshal(orgBytes, &org); err != nil {
		return nil, fmt.Errorf("failed to unmarshal organization: %v", err)
	}
	return &org, nil
}

// isConsortiumMemberDynamic checks ledger first, falls back to static check
func isConsortiumMemberDynamic(ctx contractapi.TransactionContextInterface, mspID string) bool {
	org, err := getOrganization(ctx, mspID)
	if err == nil && org != nil && org.Status == OrgStatusActive {
		return org.OrgType == OrgTypeCNA || org.OrgType == OrgTypeNationalBody
	}
	return isConsortiumMember(mspID)
}

// getTotalPossibleWeight computes total weight from all active orgs on ledger
func getTotalPossibleWeight(ctx contractapi.TransactionContextInterface) int {
	query := `{"selector":{"docType":"organization","status":"ACTIVE"}}`
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		// fallback to static
		total := 0
		for _, w := range DefaultOrgWeights {
			total += w
		}
		return total
	}
	defer iter.Close()

	total := 0
	found := false
	for iter.HasNext() {
		resp, err := iter.Next()
		if err != nil {
			break
		}
		found = true
		var org Organization
		if json.Unmarshal(resp.Value, &org) == nil {
			total += org.VoteWeight
		}
	}
	if !found {
		for _, w := range DefaultOrgWeights {
			total += w
		}
	}
	return total
}

// nowTimestamp returns the current UTC time in RFC3339 format
func nowTimestamp() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// currentYear returns the current year
func currentYear() int {
	return time.Now().UTC().Year()
}

// isValidStatus checks if a status string is valid
func isValidStatus(status string) bool {
	switch status {
	case StatusDraft, StatusUnderReview, StatusEmbargoed, StatusPublished,
		StatusDisputed, StatusDeprecated, StatusRejected:
		return true
	}
	return false
}

// isValidSeverity checks if a severity string is valid
func isValidSeverity(severity string) bool {
	switch severity {
	case SeverityCritical, SeverityHigh, SeverityMedium, SeverityLow, SeverityInformational:
		return true
	}
	return false
}

// isValidProposalType checks if a proposal type is valid
func isValidProposalType(pType string) bool {
	switch pType {
	case ProposalTypePolicyChange, ProposalTypeCNAMembership,
		ProposalTypeSeverityThreshold, ProposalTypeEmbargoExtension:
		return true
	}
	return false
}

// isValidVoteDecision checks if a vote decision is valid
func isValidVoteDecision(decision string) bool {
	switch decision {
	case VoteYes, VoteNo, VoteAbstain:
		return true
	}
	return false
}

// isValidProposalStatus checks if a proposal status is valid
func isValidProposalStatus(status string) bool {
	switch status {
	case ProposalStatusProposed, ProposalStatusActive, ProposalStatusPassed,
		ProposalStatusRejected, ProposalStatusEnacted:
		return true
	}
	return false
}

// isTransitionAllowed checks if a CVE status transition is valid
func isTransitionAllowed(current, next string) bool {
	allowed := map[string][]string{
		StatusDraft:       {StatusUnderReview, StatusRejected, StatusDeprecated},
		StatusUnderReview: {StatusEmbargoed, StatusPublished, StatusDeprecated},
		StatusEmbargoed:   {StatusPublished, StatusDeprecated},
		StatusPublished:   {StatusDisputed, StatusDeprecated},
		StatusDisputed:    {StatusPublished, StatusDeprecated},
	}
	transitions, ok := allowed[current]
	if !ok {
		return false
	}
	for _, t := range transitions {
		if t == next {
			return true
		}
	}
	return false
}

// canTransition checks if a given org can perform a specific status transition
func canTransition(mspID, ownerOrg, currentStatus, newStatus string) bool {
	switch {
	case newStatus == StatusDeprecated:
		return mspID == ownerOrg || isNationalBodyOrg(mspID)
	case currentStatus == StatusDraft && newStatus == StatusUnderReview:
		return mspID == ownerOrg
	case currentStatus == StatusDraft && newStatus == StatusRejected:
		return mspID == ownerOrg || isNationalBodyOrg(mspID)
	case currentStatus == StatusUnderReview && newStatus == StatusEmbargoed:
		return mspID == ownerOrg
	case currentStatus == StatusUnderReview && newStatus == StatusPublished:
		return mspID == ownerOrg
	case currentStatus == StatusEmbargoed && newStatus == StatusPublished:
		return true // anyone can trigger if embargo expired
	case currentStatus == StatusPublished && newStatus == StatusDisputed:
		return isConsortiumMember(mspID)
	case currentStatus == StatusDisputed && newStatus == StatusPublished:
		return mspID == ownerOrg
	}
	return false
}

// isEmbargoExpired checks if an embargo date has passed
func isEmbargoExpired(embargoDate string) bool {
	if embargoDate == "" {
		return true
	}
	t, err := time.Parse(time.RFC3339, embargoDate)
	if err != nil {
		return false
	}
	return time.Now().UTC().After(t)
}

// severityFromCVSS derives severity from CVSS score
func severityFromCVSS(score float64) string {
	switch {
	case score >= 9.0:
		return SeverityCritical
	case score >= 7.0:
		return SeverityHigh
	case score >= 4.0:
		return SeverityMedium
	case score >= 0.1:
		return SeverityLow
	default:
		return SeverityInformational
	}
}
