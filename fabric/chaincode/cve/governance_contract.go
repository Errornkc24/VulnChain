package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// GovernanceContract manages DAO-style governance voting
type GovernanceContract struct {
	contractapi.Contract
}

// InitGovernance initializes the governance proposal counter and seeds founding orgs
func (g *GovernanceContract) InitGovernance(ctx contractapi.TransactionContextInterface) error {
	counter := ProposalCounter{
		DocType: "proposalCounter",
		Counter: 0,
	}
	counterBytes, err := json.Marshal(counter)
	if err != nil {
		return fmt.Errorf("failed to marshal proposal counter: %v", err)
	}
	if err := ctx.GetStub().PutState("PROPOSAL_COUNTER", counterBytes); err != nil {
		return fmt.Errorf("failed to write proposal counter: %v", err)
	}

	// Seed founding organizations
	now := nowTimestamp()
	foundingOrgs := []Organization{
		{DocType: "organization", MSPID: "CNAAlphaMSP", Name: "CNA Alpha", OrgType: OrgTypeCNA, Status: OrgStatusActive, VoteWeight: 1, CreatedAt: now, UpdatedAt: now},
		{DocType: "organization", MSPID: "CNABetaMSP", Name: "CNA Beta", OrgType: OrgTypeCNA, Status: OrgStatusActive, VoteWeight: 1, CreatedAt: now, UpdatedAt: now},
		{DocType: "organization", MSPID: "RegulatorMSP", Name: "Regulator", OrgType: OrgTypeNationalBody, Status: OrgStatusActive, VoteWeight: 3, CreatedAt: now, UpdatedAt: now},
	}

	for _, org := range foundingOrgs {
		orgBytes, err := json.Marshal(org)
		if err != nil {
			return fmt.Errorf("failed to marshal org %s: %v", org.MSPID, err)
		}
		if err := ctx.GetStub().PutState("ORG_"+org.MSPID, orgBytes); err != nil {
			return fmt.Errorf("failed to write org %s: %v", org.MSPID, err)
		}
	}

	return nil
}

// generateProposalID atomically generates the next proposal ID
func (g *GovernanceContract) generateProposalID(ctx contractapi.TransactionContextInterface) (string, error) {
	counterBytes, err := ctx.GetStub().GetState("PROPOSAL_COUNTER")
	if err != nil {
		return "", fmt.Errorf("failed to read proposal counter: %v", err)
	}

	var counter ProposalCounter
	if counterBytes == nil {
		counter = ProposalCounter{DocType: "proposalCounter", Counter: 0}
	} else {
		if err := json.Unmarshal(counterBytes, &counter); err != nil {
			return "", fmt.Errorf("failed to unmarshal proposal counter: %v", err)
		}
	}

	counter.Counter++
	proposalID := fmt.Sprintf("PROP-%05d", counter.Counter)

	counterBytes, err = json.Marshal(counter)
	if err != nil {
		return "", fmt.Errorf("failed to marshal updated proposal counter: %v", err)
	}
	if err := ctx.GetStub().PutState("PROPOSAL_COUNTER", counterBytes); err != nil {
		return "", fmt.Errorf("failed to update proposal counter: %v", err)
	}

	return proposalID, nil
}

// CreateProposal creates a new governance proposal
func (g *GovernanceContract) CreateProposal(ctx contractapi.TransactionContextInterface, proposalJSON string) (string, error) {
	mspID, err := getClientMSPID(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get MSP ID: %v", err)
	}

	if !isConsortiumMember(mspID) {
		return "", fmt.Errorf("only consortium members can create proposals")
	}

	var proposal Proposal
	if err := json.Unmarshal([]byte(proposalJSON), &proposal); err != nil {
		return "", fmt.Errorf("failed to parse proposal data: %v", err)
	}

	if proposal.Title == "" {
		return "", fmt.Errorf("proposal title is required")
	}
	if proposal.Description == "" {
		return "", fmt.Errorf("proposal description is required")
	}
	if proposal.Type != "" && !isValidProposalType(proposal.Type) {
		return "", fmt.Errorf("invalid proposal type: %s", proposal.Type)
	}
	if proposal.Type == "" {
		proposal.Type = ProposalTypePolicyChange
	}

	proposalID, err := g.generateProposalID(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to generate proposal ID: %v", err)
	}

	clientID, _ := getClientID(ctx)
	now := nowTimestamp()

	proposal.DocType = "proposal"
	proposal.ProposalID = proposalID
	proposal.ProposerOrg = mspID
	proposal.ProposerUser = clientID
	proposal.Status = ProposalStatusProposed
	proposal.Votes = make(map[string]Vote)
	proposal.CreatedAt = now

	if proposal.Quorum == 0 {
		proposal.Quorum = 60
	}
	if proposal.Threshold == 0 {
		proposal.Threshold = 66
	}

	proposalBytes, err := json.Marshal(proposal)
	if err != nil {
		return "", fmt.Errorf("failed to marshal proposal: %v", err)
	}

	if err := ctx.GetStub().PutState(proposalID, proposalBytes); err != nil {
		return "", fmt.Errorf("failed to write proposal to ledger: %v", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"proposalId": proposalID,
		"action":     "PROPOSAL_CREATED",
		"org":        mspID,
		"type":       proposal.Type,
	})
	ctx.GetStub().SetEvent("PROPOSAL_CREATED", eventPayload)

	return proposalID, nil
}

// ActivateProposal moves a proposal from PROPOSED to ACTIVE (open for voting)
func (g *GovernanceContract) ActivateProposal(ctx contractapi.TransactionContextInterface, proposalID string) error {
	mspID, err := getClientMSPID(ctx)
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	proposalBytes, err := ctx.GetStub().GetState(proposalID)
	if err != nil {
		return fmt.Errorf("failed to read proposal: %v", err)
	}
	if proposalBytes == nil {
		return fmt.Errorf("proposal %s does not exist", proposalID)
	}

	var proposal Proposal
	if err := json.Unmarshal(proposalBytes, &proposal); err != nil {
		return fmt.Errorf("failed to unmarshal proposal: %v", err)
	}

	if proposal.ProposerOrg != mspID {
		return fmt.Errorf("only the proposer organization can activate this proposal")
	}

	if proposal.Status != ProposalStatusProposed {
		return fmt.Errorf("only PROPOSED proposals can be activated, current: %s", proposal.Status)
	}

	proposal.Status = ProposalStatusActive

	updatedBytes, err := json.Marshal(proposal)
	if err != nil {
		return fmt.Errorf("failed to marshal proposal: %v", err)
	}

	return ctx.GetStub().PutState(proposalID, updatedBytes)
}

// VoteOnProposal casts a vote on an active proposal
func (g *GovernanceContract) VoteOnProposal(ctx contractapi.TransactionContextInterface, proposalID string, decision string, reason string) error {
	mspID, err := getClientMSPID(ctx)
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	if !isConsortiumMember(mspID) {
		return fmt.Errorf("only consortium members can vote")
	}

	if !isValidVoteDecision(decision) {
		return fmt.Errorf("invalid vote decision: %s (must be YES, NO, or ABSTAIN)", decision)
	}

	proposalBytes, err := ctx.GetStub().GetState(proposalID)
	if err != nil {
		return fmt.Errorf("failed to read proposal: %v", err)
	}
	if proposalBytes == nil {
		return fmt.Errorf("proposal %s does not exist", proposalID)
	}

	var proposal Proposal
	if err := json.Unmarshal(proposalBytes, &proposal); err != nil {
		return fmt.Errorf("failed to unmarshal proposal: %v", err)
	}

	if proposal.Status != ProposalStatusActive {
		return fmt.Errorf("can only vote on ACTIVE proposals, current: %s", proposal.Status)
	}

	if _, alreadyVoted := proposal.Votes[mspID]; alreadyVoted {
		return fmt.Errorf("organization %s has already voted on this proposal", mspID)
	}

	clientID, _ := getClientID(ctx)
	weight := getVoteWeightFromLedger(ctx, mspID)

	vote := Vote{
		VoterOrg:  mspID,
		VoterUser: clientID,
		Decision:  decision,
		Weight:    weight,
		Timestamp: nowTimestamp(),
		Reason:    reason,
	}

	proposal.Votes[mspID] = vote

	updatedBytes, err := json.Marshal(proposal)
	if err != nil {
		return fmt.Errorf("failed to marshal proposal: %v", err)
	}

	if err := ctx.GetStub().PutState(proposalID, updatedBytes); err != nil {
		return fmt.Errorf("failed to update proposal: %v", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"proposalId": proposalID,
		"action":     "VOTE_CAST",
		"org":        mspID,
		"decision":   decision,
	})
	ctx.GetStub().SetEvent("VOTE_CAST", eventPayload)

	return nil
}

// TallyVotes calculates the voting result and updates proposal status
func (g *GovernanceContract) TallyVotes(ctx contractapi.TransactionContextInterface, proposalID string) (string, error) {
	proposalBytes, err := ctx.GetStub().GetState(proposalID)
	if err != nil {
		return "", fmt.Errorf("failed to read proposal: %v", err)
	}
	if proposalBytes == nil {
		return "", fmt.Errorf("proposal %s does not exist", proposalID)
	}

	var proposal Proposal
	if err := json.Unmarshal(proposalBytes, &proposal); err != nil {
		return "", fmt.Errorf("failed to unmarshal proposal: %v", err)
	}

	if proposal.Status != ProposalStatusActive {
		return "", fmt.Errorf("can only tally ACTIVE proposals, current: %s", proposal.Status)
	}

	totalPossibleWeight := getTotalPossibleWeight(ctx)
	if totalPossibleWeight == 0 {
		totalPossibleWeight = 5 // default: 2 CNAs (1 each) + 1 regulator (3)
	}

	totalVoteWeight := 0
	yesWeight := 0
	noWeight := 0
	abstainWeight := 0

	for _, vote := range proposal.Votes {
		totalVoteWeight += vote.Weight
		switch vote.Decision {
		case VoteYes:
			yesWeight += vote.Weight
		case VoteNo:
			noWeight += vote.Weight
		case VoteAbstain:
			abstainWeight += vote.Weight
		}
	}

	participationPct := 0
	if totalPossibleWeight > 0 {
		participationPct = (totalVoteWeight * 100) / totalPossibleWeight
	}

	yesPct := 0
	activeVoteWeight := yesWeight + noWeight
	if activeVoteWeight > 0 {
		yesPct = (yesWeight * 100) / activeVoteWeight
	}

	quorumMet := participationPct >= proposal.Quorum
	thresholdMet := yesPct >= proposal.Threshold

	if quorumMet && thresholdMet {
		proposal.Status = ProposalStatusPassed
	} else {
		proposal.Status = ProposalStatusRejected
	}

	updatedBytes, err := json.Marshal(proposal)
	if err != nil {
		return "", fmt.Errorf("failed to marshal proposal: %v", err)
	}

	if err := ctx.GetStub().PutState(proposalID, updatedBytes); err != nil {
		return "", fmt.Errorf("failed to update proposal: %v", err)
	}

	result := map[string]interface{}{
		"proposalId":     proposalID,
		"status":         proposal.Status,
		"totalVotes":     len(proposal.Votes),
		"yesWeight":      yesWeight,
		"noWeight":       noWeight,
		"abstainWeight":  abstainWeight,
		"participation":  participationPct,
		"approvalRate":   yesPct,
		"quorumRequired": proposal.Quorum,
		"quorumMet":      quorumMet,
		"thresholdReq":   proposal.Threshold,
		"thresholdMet":   thresholdMet,
	}

	resultBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal result: %v", err)
	}

	return string(resultBytes), nil
}

// EnactProposal moves a PASSED proposal to ENACTED
func (g *GovernanceContract) EnactProposal(ctx contractapi.TransactionContextInterface, proposalID string) error {
	mspID, err := getClientMSPID(ctx)
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	if !isConsortiumMember(mspID) {
		return fmt.Errorf("only consortium members can enact proposals")
	}

	proposalBytes, err := ctx.GetStub().GetState(proposalID)
	if err != nil {
		return fmt.Errorf("failed to read proposal: %v", err)
	}
	if proposalBytes == nil {
		return fmt.Errorf("proposal %s does not exist", proposalID)
	}

	var proposal Proposal
	if err := json.Unmarshal(proposalBytes, &proposal); err != nil {
		return fmt.Errorf("failed to unmarshal proposal: %v", err)
	}

	if proposal.Status != ProposalStatusPassed {
		return fmt.Errorf("only PASSED proposals can be enacted, current: %s", proposal.Status)
	}

	proposal.Status = ProposalStatusEnacted
	proposal.EnactedAt = nowTimestamp()

	// If CNA_MEMBERSHIP, register the new organization on the ledger
	if proposal.Type == ProposalTypeCNAMembership && proposal.Metadata != nil {
		meta := proposal.Metadata
		if meta.OrgMSPID == "" {
			return fmt.Errorf("CNA_MEMBERSHIP proposal missing orgMspId in metadata")
		}

		// Check if org already exists
		existing, _ := getOrganization(ctx, meta.OrgMSPID)
		if existing != nil && existing.Status == OrgStatusActive {
			return fmt.Errorf("organization %s is already active", meta.OrgMSPID)
		}

		orgType := meta.OrgType
		if orgType == "" {
			orgType = OrgTypeCNA
		}
		weight := meta.VoteWeight
		if weight == 0 {
			if orgType == OrgTypeNationalBody {
				weight = 3
			} else {
				weight = 1
			}
		}

		now := nowTimestamp()
		newOrg := Organization{
			DocType:      "organization",
			MSPID:        meta.OrgMSPID,
			Name:         meta.OrgName,
			OrgType:      orgType,
			Status:       OrgStatusPending, // stays PENDING until Fabric infra is ready
			VoteWeight:   weight,
			PeerEndpoint: meta.PeerEndpoint,
			ProposalID:   proposalID,
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		orgBytes, err := json.Marshal(newOrg)
		if err != nil {
			return fmt.Errorf("failed to marshal new organization: %v", err)
		}
		if err := ctx.GetStub().PutState("ORG_"+meta.OrgMSPID, orgBytes); err != nil {
			return fmt.Errorf("failed to write organization to ledger: %v", err)
		}
	}

	updatedBytes, err := json.Marshal(proposal)
	if err != nil {
		return fmt.Errorf("failed to marshal proposal: %v", err)
	}

	if err := ctx.GetStub().PutState(proposalID, updatedBytes); err != nil {
		return fmt.Errorf("failed to update proposal: %v", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"proposalId": proposalID,
		"action":     "PROPOSAL_ENACTED",
		"type":       proposal.Type,
	})
	ctx.GetStub().SetEvent("PROPOSAL_ENACTED", eventPayload)

	return nil
}

// GetProposal retrieves a single proposal
func (g *GovernanceContract) GetProposal(ctx contractapi.TransactionContextInterface, proposalID string) (string, error) {
	proposalBytes, err := ctx.GetStub().GetState(proposalID)
	if err != nil {
		return "", fmt.Errorf("failed to read proposal: %v", err)
	}
	if proposalBytes == nil {
		return "", fmt.Errorf("proposal %s does not exist", proposalID)
	}
	return string(proposalBytes), nil
}

// GetAllProposals returns all governance proposals
func (g *GovernanceContract) GetAllProposals(ctx contractapi.TransactionContextInterface) (string, error) {
	query := `{"selector":{"docType":"proposal"},"sort":[{"createdAt":"desc"}]}`
	return g.executeQuery(ctx, query)
}

// GetProposalsByStatus returns proposals filtered by status
func (g *GovernanceContract) GetProposalsByStatus(ctx contractapi.TransactionContextInterface, status string) (string, error) {
	if !isValidProposalStatus(status) {
		return "", fmt.Errorf("invalid proposal status: %s", status)
	}

	query := fmt.Sprintf(`{"selector":{"docType":"proposal","status":"%s"},"sort":[{"createdAt":"desc"}]}`, status)
	return g.executeQuery(ctx, query)
}

// executeQuery runs a CouchDB query and returns results
func (g *GovernanceContract) executeQuery(ctx contractapi.TransactionContextInterface, queryString string) (string, error) {
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return "", fmt.Errorf("failed to execute query: %v", err)
	}
	defer resultsIterator.Close()

	var results []json.RawMessage
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return "", fmt.Errorf("failed to iterate: %v", err)
		}
		results = append(results, queryResponse.Value)
	}

	if results == nil {
		return "[]", nil
	}

	resultsBytes, err := json.Marshal(results)
	if err != nil {
		return "", fmt.Errorf("failed to marshal results: %v", err)
	}

	return string(resultsBytes), nil
}

// ActivateOrg moves a PENDING organization to ACTIVE (called after Fabric infra is ready)
func (g *GovernanceContract) ActivateOrg(ctx contractapi.TransactionContextInterface, mspID string) error {
	callerMSP, err := getClientMSPID(ctx)
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}
	if !isNationalBodyOrg(callerMSP) && !isCNAOrg(callerMSP) {
		return fmt.Errorf("only existing consortium members can activate organizations")
	}

	org, err := getOrganization(ctx, mspID)
	if err != nil {
		return fmt.Errorf("failed to read organization: %v", err)
	}
	if org == nil {
		return fmt.Errorf("organization %s does not exist", mspID)
	}
	if org.Status == OrgStatusActive {
		return fmt.Errorf("organization %s is already active", mspID)
	}

	org.Status = OrgStatusActive
	org.UpdatedAt = nowTimestamp()

	orgBytes, err := json.Marshal(org)
	if err != nil {
		return fmt.Errorf("failed to marshal organization: %v", err)
	}
	if err := ctx.GetStub().PutState("ORG_"+mspID, orgBytes); err != nil {
		return fmt.Errorf("failed to update organization: %v", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"mspId":  mspID,
		"action": "ORG_ACTIVATED",
	})
	ctx.GetStub().SetEvent("ORG_ACTIVATED", eventPayload)

	return nil
}

// SuspendOrg suspends an active organization
func (g *GovernanceContract) SuspendOrg(ctx contractapi.TransactionContextInterface, mspID string) error {
	callerMSP, err := getClientMSPID(ctx)
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}
	if !isNationalBodyOrg(callerMSP) {
		return fmt.Errorf("only national body/regulator can suspend organizations")
	}

	org, err := getOrganization(ctx, mspID)
	if err != nil {
		return fmt.Errorf("failed to read organization: %v", err)
	}
	if org == nil {
		return fmt.Errorf("organization %s does not exist", mspID)
	}
	if org.Status != OrgStatusActive {
		return fmt.Errorf("can only suspend ACTIVE organizations, current: %s", org.Status)
	}

	org.Status = OrgStatusSuspended
	org.UpdatedAt = nowTimestamp()

	orgBytes, err := json.Marshal(org)
	if err != nil {
		return fmt.Errorf("failed to marshal organization: %v", err)
	}
	return ctx.GetStub().PutState("ORG_"+mspID, orgBytes)
}

// GetOrganization retrieves a single organization
func (g *GovernanceContract) GetOrganization(ctx contractapi.TransactionContextInterface, mspID string) (string, error) {
	org, err := getOrganization(ctx, mspID)
	if err != nil {
		return "", err
	}
	if org == nil {
		return "", fmt.Errorf("organization %s does not exist", mspID)
	}
	orgBytes, err := json.Marshal(org)
	if err != nil {
		return "", fmt.Errorf("failed to marshal organization: %v", err)
	}
	return string(orgBytes), nil
}

// GetAllOrganizations returns all registered organizations
func (g *GovernanceContract) GetAllOrganizations(ctx contractapi.TransactionContextInterface) (string, error) {
	query := `{"selector":{"docType":"organization"},"sort":[{"createdAt":"desc"}]}`
	return g.executeQuery(ctx, query)
}

// GetActiveOrganizations returns only active organizations
func (g *GovernanceContract) GetActiveOrganizations(ctx contractapi.TransactionContextInterface) (string, error) {
	query := `{"selector":{"docType":"organization","status":"ACTIVE"},"sort":[{"createdAt":"desc"}]}`
	return g.executeQuery(ctx, query)
}
