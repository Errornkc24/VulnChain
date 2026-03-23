package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	cveContract := new(CVEContract)
	cveContract.Name = "cve"
	cveContract.TransactionContextHandler = new(contractapi.TransactionContext)

	govContract := new(GovernanceContract)
	govContract.Name = "governance"
	govContract.TransactionContextHandler = new(contractapi.TransactionContext)

	chaincode, err := contractapi.NewChaincode(cveContract, govContract)
	if err != nil {
		log.Panicf("Error creating CVE Platform chaincode: %v", err)
	}

	chaincode.Info.Title = "CVE Management Platform"
	chaincode.Info.Version = "1.0.0"

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting CVE Platform chaincode: %v", err)
	}
}
