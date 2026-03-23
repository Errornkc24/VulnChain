# VulnChain — PlantUML Diagram Code for draw.io

> **NOTE:** The Mermaid code in `VulnChain_Project_Report.md` is the primary source. These PlantUML versions are an alternative if draw.io PlantUML import works better for your setup. The diagrams below may have more participants/detail than the simplified Mermaid versions.

> **How to use in draw.io:**
> 1. Open draw.io (app.diagrams.net)
> 2. Go to **Extras → Edit PlantUML** (or **Insert → Advanced → PlantUML**)
> 3. Paste the PlantUML code for the desired diagram
> 4. Click **Insert** — the diagram renders automatically
> 5. Export as PNG/SVG and insert into the report

---

## 1. System Architecture Diagram (Fig 6.1)

```plantuml
@startuml SystemArchitecture
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam rectangle {
    RoundCorner 10
}

skinparam package {
    BackgroundColor<<presentation>> #3498DB
    FontColor<<presentation>> #FFFFFF
    BackgroundColor<<application>> #E67E22
    FontColor<<application>> #FFFFFF
    BackgroundColor<<data>> #2C3E50
    FontColor<<data>> #FFFFFF
}

package "Presentation Layer" <<presentation>> {
    rectangle "React 18 Frontend\nVite + Tailwind CSS + Framer Motion" as FE #3498DB
}

package "Application Logic Layer" <<application>> {
    rectangle "Express.js REST API" as API #E67E22
    rectangle "JWT Auth Middleware" as AUTH #E67E22
    rectangle "RBAC Middleware" as RBAC #E67E22
    rectangle "Validation Middleware" as VAL #E67E22
    rectangle "CVE Controller" as CC #F39C12
    rectangle "Governance Controller" as GC #F39C12
    rectangle "Analytics Controller" as AC #F39C12
    rectangle "Org Controller" as OC #F39C12
}

package "Data Persistence Layer" <<data>> {
    package "Hyperledger Fabric Network" {
        rectangle "Channel 1: CVE Records" as CH1 #8E44AD
        rectangle "Channel 2: Governance" as CH2 #8E44AD
        rectangle "CVE Chaincode — Go" as CC1 #9B59B6
        rectangle "Governance Chaincode — Go" as CC2 #9B59B6
        rectangle "Peer 0 — Org1" as P1 #2C3E50
        rectangle "Peer 1 — Org2" as P2 #2C3E50
        rectangle "Orderer" as ORD #2C3E50
        rectangle "Fabric CA" as CA #2C3E50
    }
    database "SQLite — User Data" as SQLite #27AE60
    database "Redis Cache" as Redis #27AE60
}

FE -down-> API : HTTPS / REST + JWT
API -down-> AUTH
AUTH -down-> RBAC
RBAC -down-> VAL
VAL -down-> CC
VAL -down-> GC
VAL -down-> AC
VAL -down-> OC

CC -down-> CH1 : gRPC via\nFabric Gateway
GC -down-> CH2 : gRPC via\nFabric Gateway
CH1 -- CC1
CH2 -- CC2
CC1 -- P1
CC1 -- P2
CC2 -- P1
CC2 -- P2
P1 -- ORD
P2 -- ORD
CA ..> P1 : X.509 Certificates
CA ..> P2 : X.509 Certificates

CC -down-> SQLite
CC -down-> Redis
AC -down-> Redis
API -down-> SQLite
@enduml
```

---

## 2. Use Case Diagram (Fig 6.2)

```plantuml
@startuml UseCaseDiagram
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam actorStyle awesome
skinparam usecase {
    BackgroundColor #FF8C00
    FontColor #FFFFFF
    BorderColor #CC7000
}
skinparam actor {
    BackgroundColor #1B1464
    FontColor #1B1464
    BorderColor #0D0B3E
}

left to right direction

actor "PUBLIC" as PUB
actor "RESEARCHER" as RES
actor "CNA_MEMBER" as CNA
actor "NATIONAL_BODY" as NB
actor "ADMIN" as ADM
actor "Blockchain\nNetwork" as BC <<system>>

rectangle "VulnChain System" {
    usecase "Register / Login" as UC1
    usecase "Browse Published CVEs" as UC2
    usecase "Search & Filter CVEs" as UC3
    usecase "Submit CVE Draft" as UC4
    usecase "Review CVE" as UC5
    usecase "Transition CVE State" as UC6
    usecase "View CVE Timeline" as UC7
    usecase "Create Governance\nProposal" as UC8
    usecase "Cast Weighted Vote" as UC9
    usecase "View Analytics\nDashboard" as UC10
    usecase "Manage Organizations" as UC11
    usecase "Manage Users" as UC12
    usecase "View Governance\nResults" as UC13
}

' PUBLIC associations
PUB -- UC1
PUB -- UC2

' RESEARCHER associations
RES -- UC3
RES -- UC4
RES -- UC10

' CNA_MEMBER associations
CNA -- UC4
CNA -- UC5
CNA -- UC6
CNA -- UC8
CNA -- UC9
CNA -- UC13

' NATIONAL_BODY associations
NB -- UC5
NB -- UC6
NB -- UC8
NB -- UC9

' ADMIN associations
ADM -- UC6
ADM -- UC11
ADM -- UC12

' Blockchain Network (system actor)
UC4 -- BC
UC6 -- BC
UC9 -- BC

' Include relationships
UC4 ..> UC1 : <<include>>
UC6 ..> UC5 : <<include>>
UC5 ..> UC7 : <<include>>
UC9 ..> UC1 : <<include>>
UC8 ..> UC1 : <<include>>

' Extend relationships
UC3 ..> UC2 : <<extend>>
UC7 ..> UC2 : <<extend>>
@enduml
```

---

## 3. Class Diagram (Fig 6.3)

```plantuml
@startuml ClassDiagram
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam class {
    HeaderBackgroundColor #3498DB
    BackgroundColor #EBF5FB
    BorderColor #2471A3
    FontColor #1A5276
    HeaderFontColor #FFFFFF
}

class User #3498DB {
    - id : String
    - email : String
    - password : String
    - name : String
    - role : String
    - organization : String
    - createdAt : DateTime
    - updatedAt : DateTime
    + register(email, password, name, role) : User
    + login(email, password) : JWTToken
    + hasRole(role) : Boolean
    + getProfile() : User
}

class CVERecord #9B59B6 {
    - cveId : String
    - title : String
    - description : String
    - severity : String
    - status : String
    - cvssScore : Float
    - cvssVector : String
    - cweId : String
    - cweDescription : String
    - affectedProducts : List<String>
    - references : List<String>
    - submittedBy : String
    - assignedCNA : String
    - history : List<HistoryEntry>
    - createdAt : DateTime
    - updatedAt : DateTime
    + create(data) : CVERecord
    + transitionStatus(newStatus, userId) : CVERecord
    + getHistory() : List<HistoryEntry>
}

class GovernanceProposal #E67E22 {
    - proposalId : String
    - title : String
    - description : String
    - proposedBy : String
    - status : String
    - quorum : Float
    - threshold : Float
    - totalWeight : Float
    - forWeight : Float
    - againstWeight : Float
    - votes : List<Vote>
    - createdAt : DateTime
    - expiresAt : DateTime
    + create(data) : GovernanceProposal
    + castVote(userId, decision, weight) : void
    + resolveProposal() : String
}

class Vote #27AE60 {
    - voterId : String
    - decision : String
    - weight : Float
    - timestamp : DateTime
}

class HistoryEntry #1ABC9C {
    - fromStatus : String
    - toStatus : String
    - changedBy : String
    - timestamp : DateTime
    - remarks : String
}

User "1" --> "0..*" CVERecord : submits
User "1" --> "0..*" GovernanceProposal : proposes
User "1" --> "0..*" Vote : casts
GovernanceProposal "1" *-- "0..*" Vote : contains
CVERecord "1" *-- "0..*" HistoryEntry : contains
CVERecord --> "0..1" User : assignedCNA
@enduml
```

---

## 4. Sequence Diagram — CVE Submission (Fig 6.4)

```plantuml
@startuml SequenceCVESubmission
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam sequence {
    ParticipantBackgroundColor #3498DB
    ParticipantFontColor #FFFFFF
    ParticipantBorderColor #2471A3
    ActorBackgroundColor #1B1464
    ActorFontColor #1B1464
    ActorBorderColor #0D0B3E
    ArrowColor #333333
    LifeLineBorderColor #999999
}

actor "User" as User
participant "frontend :\nReact App" as FE
participant "server :\nExpress API" as API
participant "middleware :\nAuth" as Auth
participant "middleware :\nRBAC" as RBAC
participant "controller :\nCVEController" as Ctrl
participant "gateway :\nFabricGateway" as GW
participant "peer :\nEndorsingPeer" as Peer
participant "orderer :\nOrderer" as Ord
participant "db :\nSQLite" as DB
participant "cache :\nRedis" as Cache

User -> FE : fillCVEForm(title, severity, description)
activate FE

FE -> API : POST /api/cve {cveData, JWT}
activate API

API -> Auth : verifyToken(JWT)
activate Auth
Auth --> API : decoded {userId, role}
deactivate Auth

API -> RBAC : checkRole(role, ["CNA_MEMBER", "RESEARCHER"])
activate RBAC
RBAC --> API : authorized
deactivate RBAC

API -> Ctrl : createCVE(cveData, userId)
activate Ctrl

Ctrl -> GW : submitTransaction("CreateCVE", cveJSON)
activate GW

GW -> Peer : executeChaincode(CreateCVE)
activate Peer

Peer -> Peer : validate() & endorse()
Peer -> Ord : sendEndorsedTransaction()
activate Ord
Ord --> Peer : distributeBlock()
deactivate Ord

Peer --> GW : transactionCommitted(cveId)
deactivate Peer

GW --> Ctrl : result {cveId}
deactivate GW

Ctrl -> DB : storeMetadata(userId, cveId)
DB --> Ctrl : success

Ctrl -> Cache : invalidate("cve_list")
Cache --> Ctrl : cleared

Ctrl --> API : {cveId, status: 201}
deactivate Ctrl

API --> FE : HTTP 201 {cveId, message}
deactivate API

FE --> User : displaySuccessNotification(cveId)
deactivate FE
@enduml
```

---

## 5. Sequence Diagram — Governance Voting (Fig 6.5)

```plantuml
@startuml SequenceGovernanceVoting
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam sequence {
    ParticipantBackgroundColor #3498DB
    ParticipantFontColor #FFFFFF
    ParticipantBorderColor #2471A3
    ActorBackgroundColor #1B1464
    ActorFontColor #1B1464
    ActorBorderColor #0D0B3E
    ArrowColor #333333
    LifeLineBorderColor #999999
}

actor "Voter" as User
participant "frontend :\nReact App" as FE
participant "server :\nExpress API" as API
participant "middleware :\nAuth + RBAC" as Auth
participant "controller :\nGovernanceCtrl" as Ctrl
participant "gateway :\nFabricGateway" as GW
participant "chaincode :\nGovernanceContract" as CC

User -> FE : selectProposal(id) & castVote(decision)
activate FE

FE -> API : POST /api/governance/:id/vote {decision, JWT}
activate API

API -> Auth : verifyToken(JWT) & checkRole(role)
activate Auth
Auth --> API : authorized {userId, role}
deactivate Auth

API -> Ctrl : castVote(proposalId, userId, decision)
activate Ctrl

Ctrl -> Ctrl : calculateWeight(role) → weight

Ctrl -> GW : submitTransaction("CastVote",\nproposalId, voterId, decision, weight)
activate GW

GW -> CC : CastVote(proposalId, voterId, decision, weight)
activate CC

CC -> CC : checkDuplicateVote(voterId)
CC -> CC : recordVote() & updateWeights()
CC -> CC : checkQuorum(totalWeight, quorum)
CC -> CC : checkThreshold(forWeight, threshold)

alt quorum met AND threshold met
    CC -> CC : resolveProposal("APPROVED")
else quorum met AND threshold NOT met
    CC -> CC : resolveProposal("REJECTED")
end

CC --> GW : updatedProposal {status, votes, weights}
deactivate CC

GW --> Ctrl : transactionResult
deactivate GW

Ctrl --> API : {proposal, voteConfirmation}
deactivate Ctrl

API --> FE : HTTP 200 {updatedProposal}
deactivate API

FE --> User : updateProgressBars() & refreshStatus()
deactivate FE
@enduml
```

---

## 6. Activity Diagram — CVE Lifecycle (Fig 6.6)

```plantuml
@startuml ActivityCVELifecycle
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam activity {
    BackgroundColor #3498DB
    FontColor #FFFFFF
    BorderColor #2471A3
    DiamondBackgroundColor #F1C40F
    DiamondFontColor #333333
    DiamondBorderColor #D4AC0D
}

start

:Researcher / CNA discovers vulnerability;

:Submit CVE draft via platform;

#9B59B6:CVE created — **DRAFT** status;

repeat
    if (CNA picks up for review?) then (Yes)
    else (No)
        :Remains in DRAFT;
    endif
repeat while (Waiting for CNA) is (No)

:CNA reviews vulnerability details;

#9B59B6:Status → **UNDER_REVIEW**;

if (Embargo required?) then (Yes)
    :CNA / NationalBody sets embargo;
    #9B59B6:Status → **EMBARGOED**;
    repeat
        :Remains embargoed — restricted visibility;
    repeat while (Embargo conditions met?) is (No)
    -[#27AE60]->
    #27AE60:Status → **PUBLISHED**;
else (No)
    if (Review approved?) then (Yes)
        #27AE60:Status → **PUBLISHED**;
    else (No)
        :Return to DRAFT for revision;
        note right
            Loops back to
            CNA review stage
        end note
        detach
    endif
endif

:CVE visible to all users;

if (Dispute raised?) then (Yes)
    #E74C3C:Status → **DISPUTED**;
    if (Dispute resolution) then (Dispute invalid)
        #27AE60:Status → **PUBLISHED**;
        stop
    else (Record invalid / duplicate)
        #2C3E50:Status → **DEPRECATED**;
        kill
    endif
else (No)
    stop
endif

@enduml
```

---

## 7. Activity Diagram — Governance Process (Fig 6.7)

```plantuml
@startuml ActivityGovernanceProcess
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam activity {
    BackgroundColor #3498DB
    FontColor #FFFFFF
    BorderColor #2471A3
    DiamondBackgroundColor #F1C40F
    DiamondFontColor #333333
    DiamondBorderColor #D4AC0D
}

start

:Authorized user creates proposal;

:Set quorum and threshold parameters;

#3498DB:Proposal created — **ACTIVE** status;

:Eligible voters cast weighted votes;

if (Proposal expired?) then (Yes)
    if (Quorum reached?) then (Yes)
        if (FOR weight ≥ threshold?) then (Yes)
            #27AE60:Proposal → **APPROVED**;
        else (No)
            #E74C3C:Proposal → **REJECTED**;
        endif
    else (No)
        #95A5A6:Proposal → **EXPIRED**;
    endif
else (No)
    if (Quorum reached?) then (Yes)
        if (FOR weight ≥ threshold?) then (Yes)
            #27AE60:Proposal → **APPROVED**;
        else (No)
            #E74C3C:Proposal → **REJECTED**;
        endif
    else (No)
        :Continue voting;
        note right
            Loops back until
            quorum or expiry
        end note
        detach
    endif
endif

stop

@enduml
```

---

## 8. Level-0 DFD — Context Diagram (Fig 6.8)

```plantuml
@startuml DFDContextDiagram
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial

skinparam rectangle {
    BackgroundColor #2C5F7C
    FontColor #FFFFFF
    BorderColor #1A3E52
}

' External Entities (Rectangles)
rectangle "Security\nResearcher" as R
rectangle "CNA\nMember" as C
rectangle "National\nBody" as N
rectangle "Admin" as A
rectangle "Public\nUser" as P

' Central Process (Circle)
usecase "0.0\nVulnChain\nSystem" as VS #F5A623

' Data Flows
R --> VS : Vulnerability Report\nCVE Draft
VS --> R : CVE Status\nPublished CVEs

C --> VS : CVE Review\nState Transition\nVote
VS --> C : CVE List\nProposal Status\nAnalytics

N --> VS : Embargo Decision\nVote
VS --> N : CVE Records\nGovernance Results

A --> VS : Org Data\nUser Management
VS --> A : System Analytics\nUser List

P --> VS : Search Query
VS --> P : Published CVEs
@enduml
```

---

## 9. Level-1 DFD (Fig 6.9)

```plantuml
@startuml DFDLevel1
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial

skinparam rectangle {
    BackgroundColor #2C5F7C
    FontColor #FFFFFF
    BorderColor #1A3E52
}

skinparam storage {
    BackgroundColor #4CAF50
    FontColor #FFFFFF
    BorderColor #2E7D32
}

' External Entities (Rectangles)
rectangle "Researcher" as R
rectangle "CNA Member" as C
rectangle "National Body" as N
rectangle "Admin" as A
rectangle "Public" as PU

' Processes (Circles — using usecase for round shape)
usecase "1.0\nAuthentication" as P1 #F5A623
usecase "2.0\nCVE Management" as P2 #F5A623
usecase "3.0\nGovernance" as P3 #F5A623
usecase "4.0\nAnalytics" as P4 #F5A623
usecase "5.0\nOrg Management" as P5 #F5A623

' Data Stores (Open-ended rectangles)
storage "D1 | User Database — SQLite" as D1
storage "D2 | Blockchain Ledger — Fabric" as D2
storage "D3 | Cache — Redis" as D3
storage "D4 | Fabric CA" as D4

' Authentication flows
R --> P1 : Credentials
C --> P1 : Credentials
P1 --> R : JWT Token
P1 --> C : JWT Token
P1 <--> D1 : User Data

' CVE Management flows
R --> P2 : CVE Draft
C --> P2 : Review &\nTransition
P2 --> R : CVE Records
P2 --> C : CVE List
P2 <--> D2 : CVE Data
P2 <--> D3 : Cached Queries

' Governance flows
C --> P3 : Proposal & Vote
N --> P3 : Vote
P3 --> C : Results
P3 --> N : Results
P3 <--> D2 : Proposal Data

' Analytics flows
P4 --> C : Charts & Stats
P4 --> A : Charts & Stats
P4 <--> D2 : Aggregated Data
P4 <--> D3 : Cached Stats

' Org Management flows
A --> P5 : Org Data
P5 <--> D1 : User Records
P5 <--> D4 : Certificates
P5 --> A : Org List

' Public flows
PU --> P2 : Search
P2 --> PU : Published CVEs
@enduml
```

---

## 10. ER Diagram — Chen Notation (Fig 6.10)

```plantuml
@startuml ERDiagramChen
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial

' ===== Styling =====
skinparam rectangle {
    BackgroundColor #3498DB
    FontColor #FFFFFF
    BorderColor #2471A3
}

skinparam usecase {
    BackgroundColor #EBF5FB
    FontColor #1A5276
    BorderColor #5DADE2
}

skinparam hexagon {
    BackgroundColor #E67E22
    FontColor #FFFFFF
    BorderColor #CA6F1E
}

' ===== USER Entity =====
rectangle "USER" as USER #3498DB

usecase "<u>id</u> (PK)" as u_id #FEF9E7
usecase "email" as u_email
usecase "name" as u_name
usecase "role" as u_role
usecase "organization" as u_org

USER -- u_id
USER -- u_email
USER -- u_name
USER -- u_role
USER -- u_org

' ===== CVE_RECORD Entity =====
rectangle "CVE_RECORD" as CVE #3498DB

usecase "<u>cve_id</u> (PK)" as c_id #FEF9E7
usecase "title" as c_title
usecase "severity" as c_sev
usecase "status" as c_stat
usecase "cvss_score" as c_cvss
usecase "cwe_id" as c_cwe

CVE -- c_id
CVE -- c_title
CVE -- c_sev
CVE -- c_stat
CVE -- c_cvss
CVE -- c_cwe

' ===== GOVERNANCE_PROPOSAL Entity =====
rectangle "GOVERNANCE_PROPOSAL" as GP #3498DB

usecase "<u>proposal_id</u> (PK)" as g_id #FEF9E7
usecase "title " as g_title
usecase "status " as g_stat
usecase "quorum" as g_quorum
usecase "threshold" as g_thresh

GP -- g_id
GP -- g_title
GP -- g_stat
GP -- g_quorum
GP -- g_thresh

' ===== HISTORY_ENTRY — Weak Entity =====
rectangle "HISTORY_ENTRY" as HE #85C1E9

usecase "from_status" as h_from
usecase "to_status" as h_to
usecase "changed_by (FK)" as h_by #E8F8F5
usecase "timestamp" as h_ts

HE -- h_from
HE -- h_to
HE -- h_by
HE -- h_ts

' ===== VOTE — Weak Entity =====
rectangle "VOTE" as VT #85C1E9

usecase "voter_id (FK)" as v_vid #E8F8F5
usecase "decision" as v_dec
usecase "weight" as v_wt
usecase "timestamp " as v_ts

VT -- v_vid
VT -- v_dec
VT -- v_wt
VT -- v_ts

' ===== Relationships (Diamond shapes) =====
diamond "submits" as R1 #E67E22
diamond "assigned\nas CNA" as R2 #E67E22
diamond "proposes" as R3 #E67E22
diamond "casts" as R4 #E67E22
diamond "has\nhistory" as R5 #E67E22
diamond "contains" as R6 #E67E22

USER -- "1" R1
R1 -- "M" CVE

USER -- "1" R2
R2 -- "0..M" CVE

USER -- "1" R3
R3 -- "M" GP

USER -- "1" R4
R4 -- "M" VT

CVE -- "1" R5
R5 -- "M" HE

GP -- "1" R6
R6 -- "M" VT
@enduml
```

---

## 11. State Machine Diagram — CVE Lifecycle (Fig 5.1)

```plantuml
@startuml StateMachineCVE
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam state {
    FontColor #FFFFFF
    BorderColor #333333
}

[*] --> DRAFT : Researcher / CNA submits

state DRAFT #95A5A6 {
}

state UNDER_REVIEW #3498DB {
}

state EMBARGOED #F39C12 {
}

state PUBLISHED #27AE60 {
}

state DISPUTED #E74C3C {
}

state DEPRECATED #2C3E50 {
}

DRAFT --> UNDER_REVIEW : CNA begins review
UNDER_REVIEW --> EMBARGOED : Embargo required
UNDER_REVIEW --> PUBLISHED : Approved for publication
EMBARGOED --> PUBLISHED : Embargo lifted
PUBLISHED --> DISPUTED : Dispute raised
DISPUTED --> PUBLISHED : Dispute resolved (valid)
DISPUTED --> DEPRECATED : Record invalidated
PUBLISHED --> DEPRECATED : Record retired
@enduml
```

---

## Summary — All Diagrams

| # | Diagram | PlantUML File Tag | Report Figure |
|---|---|---|---|
| 1 | System Architecture | `@startuml SystemArchitecture` | Fig 6.1 |
| 2 | Use Case | `@startuml UseCaseDiagram` | Fig 6.2 |
| 3 | Class | `@startuml ClassDiagram` | Fig 6.3 |
| 4 | Sequence — CVE Submission | `@startuml SequenceCVESubmission` | Fig 6.4 |
| 5 | Sequence — Governance Voting | `@startuml SequenceGovernanceVoting` | Fig 6.5 |
| 6 | Activity — CVE Lifecycle | `@startuml ActivityCVELifecycle` | Fig 6.6 |
| 7 | Activity — Governance Process | `@startuml ActivityGovernanceProcess` | Fig 6.7 |
| 8 | DFD Level-0 (Context) | `@startuml DFDContextDiagram` | Fig 6.8 |
| 9 | DFD Level-1 | `@startuml DFDLevel1` | Fig 6.9 |
| 10 | ER Diagram (Chen Notation) | `@startuml ERDiagramChen` | Fig 6.10 |
| 11 | State Machine — CVE Lifecycle | `@startuml StateMachineCVE` | Fig 5.1 |
