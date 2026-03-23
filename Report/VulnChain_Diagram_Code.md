# VulnChain — Mermaid Diagram Code

> **How to use in draw.io:**
> 1. Open draw.io → Extras → Edit Diagram
> 2. Delete existing content, paste the Mermaid code block (without the triple backticks)
> 3. Click OK — diagram renders
> 4. **Fix curvy lines:** Select all edges (Edit → Select Edges) → Format → Style → change `curved=1` to `curved=0`
> 5. Export as PNG (File → Export as → PNG, set scale to 2x for clarity)

> **A4 fit tip:** After importing, use File → Page Setup → A4 Portrait, then Ctrl+Shift+H (Fit Page) to auto-scale.

---

## 1. System Architecture Diagram (Fig 6.1)

```mermaid
graph TB
    subgraph PL["Presentation Layer"]
        FE["React 18 Frontend\nVite + Tailwind CSS"]
    end

    subgraph AL["Application Logic Layer"]
        API["Express.js REST API"]
        AUTH["JWT Auth + RBAC Middleware"]
        CC["CVE Controller"]
        GC["Governance Controller"]
        AC["Analytics Controller"]
        OC["Org Controller"]
    end

    subgraph DL["Data Persistence Layer"]
        subgraph HF["Hyperledger Fabric Network"]
            CH1["Channel 1: CVE"]
            CH2["Channel 2: Governance"]
            CC1["CVE Chaincode"]
            CC2["Gov Chaincode"]
            P1["Peer 0 - Org1"]
            P2["Peer 1 - Org2"]
            ORD["Orderer"]
        end
        SQLite[("SQLite")]
        Redis[("Redis Cache")]
    end

    FE -->|"HTTPS/REST + JWT"| API
    API --> AUTH
    AUTH --> CC
    AUTH --> GC
    AUTH --> AC
    AUTH --> OC
    CC -->|"gRPC"| CH1
    GC -->|"gRPC"| CH2
    CH1 --- CC1
    CH2 --- CC2
    CC1 --- P1
    CC1 --- P2
    CC2 --- P1
    CC2 --- P2
    P1 --- ORD
    P2 --- ORD
    CC --> SQLite
    CC --> Redis
    API --> SQLite
```

---

## 2. Use Case Diagram (Fig 6.2)
*Vertical layout, all 13 use cases, actors on left and right sides*

```mermaid
graph TB
    A1(["PUBLIC"])
    A2(["RESEARCHER"])
    A3(["CNA_MEMBER"])
    A4(["NATIONAL_BODY"])
    A5(["ADMIN"])
    A6(["Blockchain Network"])

    subgraph sys["VulnChain System"]
        direction TB
        UC1(["Register / Login"])
        UC2(["Browse Published CVEs"])
        UC3(["Search & Filter CVEs"])
        UC4(["Submit CVE Draft"])
        UC5(["Review CVE"])
        UC6(["Transition CVE State"])
        UC7(["View CVE Timeline"])
        UC8(["Create Governance Proposal"])
        UC9(["Cast Weighted Vote"])
        UC10(["View Analytics Dashboard"])
        UC11(["View Governance Results"])
        UC12(["Manage Organizations"])
        UC13(["Manage Users"])

        UC4 -.->|"include"| UC1
        UC9 -.->|"include"| UC1
        UC8 -.->|"include"| UC1
        UC6 -.->|"include"| UC5
        UC3 -.->|"extend"| UC2
        UC7 -.->|"extend"| UC5
    end

    A1 --- UC1
    A1 --- UC2

    A2 --- UC3
    A2 --- UC4
    A2 --- UC10

    A3 --- UC4
    A3 --- UC5
    A3 --- UC6
    A3 --- UC8
    A3 --- UC9
    A3 --- UC11

    A4 --- UC5
    A4 --- UC6
    A4 --- UC8
    A4 --- UC9

    A5 --- UC6
    A5 --- UC12
    A5 --- UC13

    UC4 --- A6
    UC6 --- A6
    UC9 --- A6
```

---

## 3. Class Diagram (Fig 6.3)

```mermaid
classDiagram
    class User {
        -String id
        -String email
        -String password
        -String name
        -String role
        -String organization
        -DateTime createdAt
        +register() User
        +login() JWTToken
        +hasRole() Boolean
    }

    class CVERecord {
        -String cveId
        -String title
        -String description
        -String severity
        -String status
        -Float cvssScore
        -String cweId
        -List affectedProducts
        -List references
        -String submittedBy
        -List history
        +create() CVERecord
        +transitionStatus() CVERecord
    }

    class GovernanceProposal {
        -String proposalId
        -String title
        -String description
        -String status
        -Float quorum
        -Float threshold
        -Float totalWeight
        -List votes
        +create() GovernanceProposal
        +castVote() void
        +resolveProposal() String
    }

    class Vote {
        -String voterId
        -String decision
        -Float weight
        -DateTime timestamp
    }

    class HistoryEntry {
        -String fromStatus
        -String toStatus
        -String changedBy
        -DateTime timestamp
    }

    User "1" --> "0..*" CVERecord : submits
    User "1" --> "0..*" GovernanceProposal : proposes
    User "1" --> "0..*" Vote : casts
    GovernanceProposal "1" *-- "0..*" Vote : contains
    CVERecord "1" *-- "0..*" HistoryEntry : contains
    User "0..1" <-- CVERecord : assignedCNA
```

---

## 4. Sequence Diagram — CVE Submission (Fig 6.4)

```mermaid
sequenceDiagram
    actor User
    participant FE as React Frontend
    participant API as Express API
    participant Ctrl as CVE Controller
    participant GW as Fabric Gateway
    participant BC as Blockchain

    User->>FE: Fill CVE form and submit
    activate FE
    FE->>API: POST /api/cve {cveData, JWT}
    activate API
    API->>API: verifyJWT() + checkRole()
    API->>Ctrl: createCVE(cveData, userId)
    activate Ctrl
    Ctrl->>GW: submitTransaction("CreateCVE")
    activate GW
    GW->>BC: executeChaincode
    activate BC
    BC->>BC: validate, endorse, commit
    BC-->>GW: committed(cveId)
    deactivate BC
    GW-->>Ctrl: result {cveId}
    deactivate GW
    Ctrl->>Ctrl: store metadata + clear cache
    Ctrl-->>API: {cveId, 201}
    deactivate Ctrl
    API-->>FE: HTTP 201 {cveId}
    deactivate API
    FE-->>User: Success notification
    deactivate FE
```

---

## 5. Sequence Diagram — Governance Voting (Fig 6.5)

```mermaid
sequenceDiagram
    actor Voter
    participant FE as React Frontend
    participant API as Express API
    participant Ctrl as Gov Controller
    participant BC as Gov Chaincode

    Voter->>FE: Select proposal, cast vote
    activate FE
    FE->>API: POST /api/governance/:id/vote
    activate API
    API->>API: verifyJWT() + checkRole()
    API->>Ctrl: castVote(id, userId, decision)
    activate Ctrl
    Ctrl->>Ctrl: calculateWeight(role)
    Ctrl->>BC: CastVote(id, decision, weight)
    activate BC
    BC->>BC: checkDuplicate()
    BC->>BC: recordVote, updateWeights
    BC->>BC: checkQuorum + Threshold
    alt Conditions met
        BC->>BC: resolve(APPROVED/REJECTED)
    end
    BC-->>Ctrl: updatedProposal
    deactivate BC
    Ctrl-->>API: voteConfirmation
    deactivate Ctrl
    API-->>FE: HTTP 200
    deactivate API
    FE-->>Voter: Update UI
    deactivate FE
```

---

## 6. Activity Diagram — CVE Lifecycle (Fig 6.6)

```mermaid
flowchart TD
    A([Start]) --> B[Submit CVE Draft]
    B --> C[/DRAFT/]
    C --> D{CNA Review}
    D -->|Rejected| C
    D -->|Accepted| E[/UNDER_REVIEW/]
    E --> F{Embargo needed?}
    F -->|Yes| G[/EMBARGOED/]
    G --> H[/PUBLISHED/]
    F -->|No| H
    H --> I{Dispute?}
    I -->|No| J([End])
    I -->|Yes| K[/DISPUTED/]
    K --> L{Resolution}
    L -->|Valid| H
    L -->|Invalid| M[/DEPRECATED/]
    M --> N([End])
```

---

## 7. Activity Diagram — Governance Process (Fig 6.7)

```mermaid
flowchart TD
    A([Start]) --> B[Create Proposal]
    B --> C[Set quorum & threshold]
    C --> D[/ACTIVE/]
    D --> E[Voters cast weighted votes]
    E --> F{Expired?}
    F -->|No| G{Quorum reached?}
    G -->|No| E
    G -->|Yes| H{FOR >= threshold?}
    H -->|Yes| I[/APPROVED/]
    H -->|No| J[/REJECTED/]
    F -->|Yes| K{Quorum reached?}
    K -->|No| L[/EXPIRED/]
    K -->|Yes| H
    I --> M([End])
    J --> M
    L --> M
```

---

## 8. Level-0 DFD — Context Diagram (Fig 6.8)

```mermaid
graph TD
    R["Researcher"] -->|"CVE Draft"| VS(("0.0 VulnChain System"))
    VS -->|"Published CVEs"| R
    C["CNA Member"] -->|"Review, Vote"| VS
    VS -->|"CVE List, Analytics"| C
    N["National Body"] -->|"Embargo, Vote"| VS
    VS -->|"Governance Results"| N
    A["Admin"] -->|"Org & User Mgmt"| VS
    VS -->|"System Analytics"| A
    P["Public User"] -->|"Search"| VS
    VS -->|"Published CVEs"| P
```

---

## 9. Level-1 DFD (Fig 6.9)

```mermaid
graph LR
    subgraph Entities
        R["Researcher"]
        C["CNA Member"]
        N["National Body"]
        A["Admin"]
        PU["Public"]
    end

    subgraph Processes
        P1(("1.0 Auth"))
        P2(("2.0 CVE Mgmt"))
        P3(("3.0 Governance"))
        P4(("4.0 Analytics"))
        P5(("5.0 Org Mgmt"))
    end

    subgraph Data_Stores
        D1[["D1 User DB"]]
        D2[["D2 Blockchain"]]
        D3[["D3 Cache"]]
        D4[["D4 Fabric CA"]]
    end

    R -->|"Credentials"| P1
    C -->|"Credentials"| P1
    P1 -->|"JWT"| R
    P1 -->|"JWT"| C
    P1 <--> D1

    R -->|"CVE Draft"| P2
    C -->|"Review"| P2
    P2 -->|"CVE List"| C
    P2 <--> D2
    P2 <--> D3

    C -->|"Proposal, Vote"| P3
    N -->|"Vote"| P3
    P3 -->|"Results"| C
    P3 <--> D2

    P4 -->|"Stats"| A
    P4 <--> D2
    P4 <--> D3

    A -->|"Org Data"| P5
    P5 <--> D1
    P5 <--> D4
    P5 -->|"Org List"| A

    PU -->|"Search"| P2
    P2 -->|"Published CVEs"| PU
```

---

## 10. ER Diagram — Chen Notation (Fig 6.10)
*Structured top-down: entities in center row, attributes above/below, relationships between*

```mermaid
graph TD
    subgraph USER_ATTRS[" "]
        direction LR
        u_id(["id PK"])
        u_email(["email"])
        u_name(["name"])
        u_role(["role"])
    end

    subgraph CVE_ATTRS[" "]
        direction LR
        c_id(["cve_id PK"])
        c_title(["title"])
        c_sev(["severity"])
        c_stat(["status"])
    end

    subgraph GP_ATTRS[" "]
        direction LR
        g_id(["proposal_id PK"])
        g_title(["title "])
        g_stat(["status "])
        g_q(["quorum"])
    end

    USER_ATTRS --- USER["USER"]
    CVE_ATTRS --- CVE["CVE_RECORD"]
    GP_ATTRS --- GP["GOVERNANCE_PROPOSAL"]

    USER ---|"1"| R1{"submits"} ---|"M"| CVE
    USER ---|"1"| R3{"proposes"} ---|"M"| GP

    subgraph HE_ATTRS[" "]
        direction LR
        h_from(["from_status"])
        h_to(["to_status"])
        h_by(["changed_by FK"])
    end

    subgraph VT_ATTRS[" "]
        direction LR
        v_id(["voter_id FK"])
        v_dec(["decision"])
        v_wt(["weight"])
    end

    HE["HISTORY_ENTRY"] --- HE_ATTRS
    VT["VOTE"] --- VT_ATTRS

    CVE ---|"1"| R5{"has history"} ---|"M"| HE
    GP ---|"1"| R6{"contains"} ---|"M"| VT
    USER ---|"1"| R4{"casts"} ---|"M"| VT
```

---

## 11. State Machine — CVE Lifecycle (Fig 5.1)

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Researcher/CNA submits
    DRAFT --> UNDER_REVIEW : CNA begins review
    UNDER_REVIEW --> EMBARGOED : Embargo required
    UNDER_REVIEW --> PUBLISHED : Approved
    EMBARGOED --> PUBLISHED : Embargo lifted
    PUBLISHED --> DISPUTED : Dispute raised
    DISPUTED --> PUBLISHED : Dispute resolved
    DISPUTED --> DEPRECATED : Record invalidated
    PUBLISHED --> DEPRECATED : Record retired
```

---

## Summary

| # | Diagram | Figure | A4 Orientation |
|---|---|---|---|
| 1 | System Architecture | Fig 6.1 | Portrait |
| 2 | Use Case (13 use cases) | Fig 6.2 | Portrait |
| 3 | Class Diagram | Fig 6.3 | Landscape or Portrait |
| 4 | Sequence — CVE Submission | Fig 6.4 | Portrait |
| 5 | Sequence — Governance Voting | Fig 6.5 | Portrait |
| 6 | Activity — CVE Lifecycle | Fig 6.6 | Portrait |
| 7 | Activity — Governance | Fig 6.7 | Portrait |
| 8 | DFD Level-0 (Context) | Fig 6.8 | Portrait |
| 9 | DFD Level-1 | Fig 6.9 | Landscape |
| 10 | ER Diagram (Chen) | Fig 6.10 | Landscape |
| 11 | State Machine | Fig 5.1 | Portrait |

> **After importing each diagram in draw.io:**
> 1. Select all → Format → Style → set `curved=0` for straight lines
> 2. Ctrl+Shift+H to fit to page
> 3. Manually adjust positions if needed for cleaner layout
> 4. Export as PNG at 2x scale for print quality
