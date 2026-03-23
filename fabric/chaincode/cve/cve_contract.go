package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// CVEContract manages CVE records on the blockchain
type CVEContract struct {
	contractapi.Contract
}

// InitLedger initializes the chaincode with counters
func (c *CVEContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	counter := CVECounter{
		DocType: "cveCounter",
		Year:    currentYear(),
		Counter: 0,
	}
	counterBytes, err := json.Marshal(counter)
	if err != nil {
		return fmt.Errorf("failed to marshal counter: %v", err)
	}
	return ctx.GetStub().PutState("CVE_COUNTER", counterBytes)
}

// generateCVEID atomically generates the next CVE ID
func (c *CVEContract) generateCVEID(ctx contractapi.TransactionContextInterface) (string, error) {
	counterBytes, err := ctx.GetStub().GetState("CVE_COUNTER")
	if err != nil {
		return "", fmt.Errorf("failed to read counter: %v", err)
	}

	var counter CVECounter
	if counterBytes == nil {
		counter = CVECounter{DocType: "cveCounter", Year: currentYear(), Counter: 0}
	} else {
		if err := json.Unmarshal(counterBytes, &counter); err != nil {
			return "", fmt.Errorf("failed to unmarshal counter: %v", err)
		}
	}

	year := currentYear()
	if counter.Year != year {
		counter.Year = year
		counter.Counter = 0
	}

	counter.Counter++
	cveID := fmt.Sprintf("CVE-%d-%05d", counter.Year, counter.Counter)

	counterBytes, err = json.Marshal(counter)
	if err != nil {
		return "", fmt.Errorf("failed to marshal updated counter: %v", err)
	}
	if err := ctx.GetStub().PutState("CVE_COUNTER", counterBytes); err != nil {
		return "", fmt.Errorf("failed to update counter: %v", err)
	}

	return cveID, nil
}

// CreateCVE creates a new CVE record on the blockchain
func (c *CVEContract) CreateCVE(ctx contractapi.TransactionContextInterface, cveJSON string) (string, error) {
	mspID, err := getClientMSPID(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get MSP ID: %v", err)
	}

	if !canWriteCVE(mspID) {
		return "", fmt.Errorf("organization %s does not have permission to create CVEs", mspID)
	}

	var cve CVERecord
	if err := json.Unmarshal([]byte(cveJSON), &cve); err != nil {
		return "", fmt.Errorf("failed to parse CVE data: %v", err)
	}

	if cve.Title == "" {
		return "", fmt.Errorf("title is required")
	}
	if cve.Description == "" {
		return "", fmt.Errorf("description is required")
	}
	if cve.AffectedProduct == "" {
		return "", fmt.Errorf("affected product is required")
	}
	if cve.CVSSScore < 0 || cve.CVSSScore > 10 {
		return "", fmt.Errorf("CVSS score must be between 0 and 10")
	}
	if cve.Severity != "" && !isValidSeverity(cve.Severity) {
		return "", fmt.Errorf("invalid severity: %s", cve.Severity)
	}

	cveID, err := c.generateCVEID(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to generate CVE ID: %v", err)
	}

	clientID, _ := getClientID(ctx)
	now := nowTimestamp()

	if cve.Severity == "" {
		cve.Severity = severityFromCVSS(cve.CVSSScore)
	}

	cve.DocType = "cve"
	cve.CVEID = cveID
	cve.Status = StatusDraft
	cve.SubmitterOrg = mspID
	cve.SubmitterUser = clientID
	cve.OwnerOrg = mspID
	cve.CreatedAt = now
	cve.UpdatedAt = now

	if cve.AffectedVersions == nil {
		cve.AffectedVersions = []string{}
	}
	if cve.CPEIdentifiers == nil {
		cve.CPEIdentifiers = []string{}
	}
	if cve.References == nil {
		cve.References = []string{}
	}

	cve.History = []HistoryEntry{
		{
			Action:    ActionCreated,
			Actor:     clientID,
			ActorOrg:  mspID,
			Timestamp: now,
			Notes:     "CVE record created",
			NewValue:  StatusDraft,
		},
	}

	cveBytes, err := json.Marshal(cve)
	if err != nil {
		return "", fmt.Errorf("failed to marshal CVE: %v", err)
	}

	if err := ctx.GetStub().PutState(cveID, cveBytes); err != nil {
		return "", fmt.Errorf("failed to write CVE to ledger: %v", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"cveId":  cveID,
		"action": "CVE_CREATED",
		"org":    mspID,
		"status": StatusDraft,
	})
	ctx.GetStub().SetEvent("CVE_CREATED", eventPayload)

	return cveID, nil
}

// UpdateCVE updates an existing CVE record (only in DRAFT or UNDER_REVIEW)
func (c *CVEContract) UpdateCVE(ctx contractapi.TransactionContextInterface, cveID string, updateJSON string) error {
	mspID, err := getClientMSPID(ctx)
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	cveBytes, err := ctx.GetStub().GetState(cveID)
	if err != nil {
		return fmt.Errorf("failed to read CVE: %v", err)
	}
	if cveBytes == nil {
		return fmt.Errorf("CVE %s does not exist", cveID)
	}

	var cve CVERecord
	if err := json.Unmarshal(cveBytes, &cve); err != nil {
		return fmt.Errorf("failed to unmarshal CVE: %v", err)
	}

	if cve.OwnerOrg != mspID {
		return fmt.Errorf("only the owner organization can update this CVE")
	}

	if cve.Status != StatusDraft && cve.Status != StatusUnderReview {
		return fmt.Errorf("CVE can only be updated in DRAFT or UNDER_REVIEW status, current: %s", cve.Status)
	}

	var updates map[string]interface{}
	if err := json.Unmarshal([]byte(updateJSON), &updates); err != nil {
		return fmt.Errorf("failed to parse update data: %v", err)
	}

	if v, ok := updates["title"].(string); ok && v != "" {
		cve.Title = v
	}
	if v, ok := updates["description"].(string); ok && v != "" {
		cve.Description = v
	}
	if v, ok := updates["affectedProduct"].(string); ok && v != "" {
		cve.AffectedProduct = v
	}
	if v, ok := updates["cvssScore"].(float64); ok {
		if v < 0 || v > 10 {
			return fmt.Errorf("CVSS score must be between 0 and 10")
		}
		cve.CVSSScore = v
		cve.Severity = severityFromCVSS(v)
	}
	if v, ok := updates["cvssVector"].(string); ok {
		cve.CVSSVector = v
	}
	if v, ok := updates["severity"].(string); ok && v != "" {
		if !isValidSeverity(v) {
			return fmt.Errorf("invalid severity: %s", v)
		}
		cve.Severity = v
	}
	if v, ok := updates["cweId"].(string); ok {
		cve.CWEId = v
	}
	if v, ok := updates["cweDescription"].(string); ok {
		cve.CWEDescription = v
	}
	if v, ok := updates["embargoDate"].(string); ok {
		cve.EmbargoDate = v
	}
	if v, ok := updates["patchInfo"].(string); ok {
		cve.PatchInfo = v
	}
	if v, ok := updates["affectedVersions"].([]interface{}); ok {
		versions := make([]string, len(v))
		for i, ver := range v {
			versions[i] = fmt.Sprintf("%v", ver)
		}
		cve.AffectedVersions = versions
	}
	if v, ok := updates["cpeIdentifiers"].([]interface{}); ok {
		cpes := make([]string, len(v))
		for i, cpe := range v {
			cpes[i] = fmt.Sprintf("%v", cpe)
		}
		cve.CPEIdentifiers = cpes
	}
	if v, ok := updates["references"].([]interface{}); ok {
		refs := make([]string, len(v))
		for i, ref := range v {
			refs[i] = fmt.Sprintf("%v", ref)
		}
		cve.References = refs
	}

	clientID, _ := getClientID(ctx)
	now := nowTimestamp()
	cve.UpdatedAt = now

	cve.History = append(cve.History, HistoryEntry{
		Action:    ActionUpdated,
		Actor:     clientID,
		ActorOrg:  mspID,
		Timestamp: now,
		Notes:     "CVE record updated",
	})

	updatedBytes, err := json.Marshal(cve)
	if err != nil {
		return fmt.Errorf("failed to marshal updated CVE: %v", err)
	}

	if err := ctx.GetStub().PutState(cveID, updatedBytes); err != nil {
		return fmt.Errorf("failed to update CVE on ledger: %v", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"cveId":  cveID,
		"action": "CVE_UPDATED",
		"org":    mspID,
	})
	ctx.GetStub().SetEvent("CVE_UPDATED", eventPayload)

	return nil
}

// TransitionStatus transitions a CVE to a new lifecycle status
func (c *CVEContract) TransitionStatus(ctx contractapi.TransactionContextInterface, cveID string, newStatus string, notes string) error {
	mspID, err := getClientMSPID(ctx)
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	if !isValidStatus(newStatus) {
		return fmt.Errorf("invalid status: %s", newStatus)
	}

	cveBytes, err := ctx.GetStub().GetState(cveID)
	if err != nil {
		return fmt.Errorf("failed to read CVE: %v", err)
	}
	if cveBytes == nil {
		return fmt.Errorf("CVE %s does not exist", cveID)
	}

	var cve CVERecord
	if err := json.Unmarshal(cveBytes, &cve); err != nil {
		return fmt.Errorf("failed to unmarshal CVE: %v", err)
	}

	if !isTransitionAllowed(cve.Status, newStatus) {
		return fmt.Errorf("transition from %s to %s is not allowed", cve.Status, newStatus)
	}

	if !canTransition(mspID, cve.OwnerOrg, cve.Status, newStatus) {
		return fmt.Errorf("organization %s is not authorized for this transition", mspID)
	}

	if cve.Status == StatusEmbargoed && newStatus == StatusPublished {
		if !isEmbargoExpired(cve.EmbargoDate) {
			return fmt.Errorf("cannot publish: embargo has not expired (expires: %s)", cve.EmbargoDate)
		}
	}

	if newStatus == StatusEmbargoed && cve.EmbargoDate == "" {
		return fmt.Errorf("embargo date must be set before transitioning to EMBARGOED status")
	}

	clientID, _ := getClientID(ctx)
	now := nowTimestamp()
	oldStatus := cve.Status

	cve.Status = newStatus
	cve.UpdatedAt = now

	cve.History = append(cve.History, HistoryEntry{
		Action:    ActionStatusChange,
		Actor:     clientID,
		ActorOrg:  mspID,
		Timestamp: now,
		Notes:     notes,
		OldValue:  oldStatus,
		NewValue:  newStatus,
	})

	updatedBytes, err := json.Marshal(cve)
	if err != nil {
		return fmt.Errorf("failed to marshal CVE: %v", err)
	}

	if err := ctx.GetStub().PutState(cveID, updatedBytes); err != nil {
		return fmt.Errorf("failed to update CVE on ledger: %v", err)
	}

	if newStatus == StatusEmbargoed {
		privateData := map[string]interface{}{
			"cveId":       cveID,
			"description": cve.Description,
			"cvssScore":   cve.CVSSScore,
			"cvssVector":  cve.CVSSVector,
			"patchInfo":   cve.PatchInfo,
			"references":  cve.References,
		}
		privateBytes, _ := json.Marshal(privateData)
		ctx.GetStub().PutPrivateData(EmbargoCollection, cveID, privateBytes)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"cveId":     cveID,
		"action":    "STATUS_CHANGED",
		"oldStatus": oldStatus,
		"newStatus": newStatus,
		"org":       mspID,
	})
	ctx.GetStub().SetEvent("STATUS_CHANGED", eventPayload)

	return nil
}

// GetCVE retrieves a single CVE record
func (c *CVEContract) GetCVE(ctx contractapi.TransactionContextInterface, cveID string) (string, error) {
	cveBytes, err := ctx.GetStub().GetState(cveID)
	if err != nil {
		return "", fmt.Errorf("failed to read CVE: %v", err)
	}
	if cveBytes == nil {
		return "", fmt.Errorf("CVE %s does not exist", cveID)
	}

	var cve CVERecord
	if err := json.Unmarshal(cveBytes, &cve); err != nil {
		return "", fmt.Errorf("failed to unmarshal CVE: %v", err)
	}

	mspID, _ := getClientMSPID(ctx)

	if cve.Status == StatusEmbargoed && !canReadEmbargoed(mspID) {
		publicView := PublicCVEView{
			DocType:         "cvePublicView",
			CVEID:           cve.CVEID,
			AffectedProduct: cve.AffectedProduct,
			EmbargoDate:     cve.EmbargoDate,
			Status:          cve.Status,
		}
		viewBytes, _ := json.Marshal(publicView)
		return string(viewBytes), nil
	}

	if (cve.Status == StatusDraft || cve.Status == StatusUnderReview) && !isConsortiumMember(mspID) {
		return "", fmt.Errorf("access denied: CVE %s is not publicly available", cveID)
	}

	return string(cveBytes), nil
}

// QueryCVEs performs a rich query against CouchDB
func (c *CVEContract) QueryCVEs(ctx contractapi.TransactionContextInterface, queryJSON string) (string, error) {
	var filter QueryFilter
	if err := json.Unmarshal([]byte(queryJSON), &filter); err != nil {
		return "", fmt.Errorf("failed to parse query: %v", err)
	}

	mspID, _ := getClientMSPID(ctx)
	isConsortium := isConsortiumMember(mspID)

	selector := map[string]interface{}{
		"docType": "cve",
	}

	if filter.Status != "" {
		selector["status"] = filter.Status
	} else if !isConsortium {
		selector["status"] = StatusPublished
	}

	if filter.Severity != "" {
		selector["severity"] = filter.Severity
	}
	if filter.Product != "" {
		selector["affectedProduct"] = map[string]interface{}{
			"$regex": fmt.Sprintf("(?i)%s", filter.Product),
		}
	}

	if filter.FromDate != "" || filter.ToDate != "" {
		dateFilter := map[string]interface{}{}
		if filter.FromDate != "" {
			dateFilter["$gte"] = filter.FromDate
		}
		if filter.ToDate != "" {
			dateFilter["$lte"] = filter.ToDate
		}
		selector["createdAt"] = dateFilter
	}

	query := map[string]interface{}{
		"selector": selector,
		"sort":     []map[string]string{{"createdAt": "desc"}},
	}

	queryBytes, err := json.Marshal(query)
	if err != nil {
		return "", fmt.Errorf("failed to build query: %v", err)
	}

	resultsIterator, err := ctx.GetStub().GetQueryResult(string(queryBytes))
	if err != nil {
		return "", fmt.Errorf("failed to execute query: %v", err)
	}
	defer resultsIterator.Close()

	var results []CVERecord
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return "", fmt.Errorf("failed to iterate results: %v", err)
		}

		var cve CVERecord
		if err := json.Unmarshal(queryResponse.Value, &cve); err != nil {
			continue
		}

		if !isConsortium && (cve.Status == StatusDraft || cve.Status == StatusUnderReview) {
			continue
		}

		results = append(results, cve)
	}

	if results == nil {
		results = []CVERecord{}
	}

	resultsBytes, err := json.Marshal(results)
	if err != nil {
		return "", fmt.Errorf("failed to marshal results: %v", err)
	}

	return string(resultsBytes), nil
}

// GetCVEsByStatus queries CVEs by their lifecycle status
func (c *CVEContract) GetCVEsByStatus(ctx contractapi.TransactionContextInterface, status string) (string, error) {
	if !isValidStatus(status) {
		return "", fmt.Errorf("invalid status: %s", status)
	}

	mspID, _ := getClientMSPID(ctx)
	if !isConsortiumMember(mspID) && status != StatusPublished {
		return "", fmt.Errorf("public users can only query PUBLISHED CVEs")
	}

	query := fmt.Sprintf(`{"selector":{"docType":"cve","status":"%s"},"sort":[{"createdAt":"desc"}]}`, status)
	return c.executeQuery(ctx, query)
}

// GetCVEsByProduct queries CVEs by affected product
func (c *CVEContract) GetCVEsByProduct(ctx contractapi.TransactionContextInterface, product string) (string, error) {
	mspID, _ := getClientMSPID(ctx)
	isConsortium := isConsortiumMember(mspID)

	var query string
	if isConsortium {
		query = fmt.Sprintf(`{"selector":{"docType":"cve","affectedProduct":{"$regex":"(?i)%s"}}}`, product)
	} else {
		query = fmt.Sprintf(`{"selector":{"docType":"cve","affectedProduct":{"$regex":"(?i)%s"},"status":"PUBLISHED"}}`, product)
	}
	return c.executeQuery(ctx, query)
}

// GetCVEsBySeverity queries CVEs by severity level
func (c *CVEContract) GetCVEsBySeverity(ctx contractapi.TransactionContextInterface, severity string) (string, error) {
	if !isValidSeverity(severity) {
		return "", fmt.Errorf("invalid severity: %s", severity)
	}

	mspID, _ := getClientMSPID(ctx)
	isConsortium := isConsortiumMember(mspID)

	var query string
	if isConsortium {
		query = fmt.Sprintf(`{"selector":{"docType":"cve","severity":"%s"},"sort":[{"cvssScore":"desc"}]}`, severity)
	} else {
		query = fmt.Sprintf(`{"selector":{"docType":"cve","severity":"%s","status":"PUBLISHED"},"sort":[{"cvssScore":"desc"}]}`, severity)
	}
	return c.executeQuery(ctx, query)
}

// GetCVEHistory retrieves the history of a CVE record
func (c *CVEContract) GetCVEHistory(ctx contractapi.TransactionContextInterface, cveID string) (string, error) {
	cveBytes, err := ctx.GetStub().GetState(cveID)
	if err != nil {
		return "", fmt.Errorf("failed to read CVE: %v", err)
	}
	if cveBytes == nil {
		return "", fmt.Errorf("CVE %s does not exist", cveID)
	}

	var cve CVERecord
	if err := json.Unmarshal(cveBytes, &cve); err != nil {
		return "", fmt.Errorf("failed to unmarshal CVE: %v", err)
	}

	historyBytes, err := json.Marshal(cve.History)
	if err != nil {
		return "", fmt.Errorf("failed to marshal history: %v", err)
	}

	return string(historyBytes), nil
}

// GetCVECount returns counts of CVEs grouped by status
func (c *CVEContract) GetCVECount(ctx contractapi.TransactionContextInterface) (string, error) {
	counts := CVECountByStatus{}
	statuses := []string{StatusDraft, StatusUnderReview, StatusEmbargoed, StatusPublished, StatusDisputed, StatusDeprecated, StatusRejected}

	for _, status := range statuses {
		query := fmt.Sprintf(`{"selector":{"docType":"cve","status":"%s"},"fields":["cveId"]}`, status)
		resultsIterator, err := ctx.GetStub().GetQueryResult(query)
		if err != nil {
			continue
		}

		count := 0
		for resultsIterator.HasNext() {
			_, err := resultsIterator.Next()
			if err != nil {
				break
			}
			count++
		}
		resultsIterator.Close()

		switch status {
		case StatusDraft:
			counts.Draft = count
		case StatusUnderReview:
			counts.UnderReview = count
		case StatusEmbargoed:
			counts.Embargoed = count
		case StatusPublished:
			counts.Published = count
		case StatusDisputed:
			counts.Disputed = count
		case StatusDeprecated:
			counts.Deprecated = count
		case StatusRejected:
			counts.Rejected = count
		}
		counts.Total += count
	}

	countsBytes, err := json.Marshal(counts)
	if err != nil {
		return "", fmt.Errorf("failed to marshal counts: %v", err)
	}

	return string(countsBytes), nil
}

// GetAllCVEs returns all CVEs (consortium sees all, public sees only published)
func (c *CVEContract) GetAllCVEs(ctx contractapi.TransactionContextInterface) (string, error) {
	mspID, _ := getClientMSPID(ctx)
	isConsortium := isConsortiumMember(mspID)

	var query string
	if isConsortium {
		query = `{"selector":{"docType":"cve"},"sort":[{"createdAt":"desc"}]}`
	} else {
		query = `{"selector":{"docType":"cve","status":"PUBLISHED"},"sort":[{"createdAt":"desc"}]}`
	}

	return c.executeQuery(ctx, query)
}

// executeQuery is a helper that runs a CouchDB rich query and returns results as JSON array
func (c *CVEContract) executeQuery(ctx contractapi.TransactionContextInterface, queryString string) (string, error) {
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

// CVEExists checks if a CVE record exists
func (c *CVEContract) CVEExists(ctx contractapi.TransactionContextInterface, cveID string) (bool, error) {
	cveBytes, err := ctx.GetStub().GetState(cveID)
	if err != nil {
		return false, fmt.Errorf("failed to read CVE: %v", err)
	}
	return cveBytes != nil, nil
}

// SearchCVEs performs a text search across CVE titles and descriptions
func (c *CVEContract) SearchCVEs(ctx contractapi.TransactionContextInterface, searchTerm string) (string, error) {
	mspID, _ := getClientMSPID(ctx)
	isConsortium := isConsortiumMember(mspID)

	term := strings.ToLower(searchTerm)

	var query string
	if isConsortium {
		query = fmt.Sprintf(`{"selector":{"docType":"cve","$or":[{"title":{"$regex":"(?i)%s"}},{"description":{"$regex":"(?i)%s"}},{"affectedProduct":{"$regex":"(?i)%s"}}]}}`, term, term, term)
	} else {
		query = fmt.Sprintf(`{"selector":{"docType":"cve","status":"PUBLISHED","$or":[{"title":{"$regex":"(?i)%s"}},{"description":{"$regex":"(?i)%s"}},{"affectedProduct":{"$regex":"(?i)%s"}}]}}`, term, term, term)
	}

	return c.executeQuery(ctx, query)
}
