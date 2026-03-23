module.exports = {
  channelPublic: process.env.FABRIC_CHANNEL_PUBLIC || 'cvepublic',
  channelConsortium: process.env.FABRIC_CHANNEL_CONSORTIUM || 'cveconsortium',
  chaincodeName: process.env.FABRIC_CHAINCODE_NAME || 'cve-chaincode',
  mspId: process.env.FABRIC_MSP_ID || 'CNAAlphaMSP',
  peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
  demoMode: process.env.DEMO_MODE === 'true',
  orgs: {
    CNAAlphaMSP: {
      peerEndpoint: 'localhost:7051',
      domain: 'cna-alpha.cve.local',
    },
    CNABetaMSP: {
      peerEndpoint: 'localhost:9051',
      domain: 'cna-beta.cve.local',
    },
    RegulatorMSP: {
      peerEndpoint: 'localhost:11051',
      domain: 'regulator.cve.local',
    },
  },
};
