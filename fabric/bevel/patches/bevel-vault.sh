##############################################################################################
#  Copyright Accenture. All Rights Reserved.
#
#  SPDX-License-Identifier: Apache-2.0
##############################################################################################

# Validate HashiCorp Vault responses
validateVaultResponseHashicorp() {
    if [ "$2" = "LOOKUPSECRETRESPONSE" ]; then
        http_code=$(curl -fsS -o /dev/null -w "%{http_code}" \
            --header "X-Vault-Token: ${VAULT_TOKEN}" \
            "${VAULT_ADDR}/v1/${1}")
        curl_response=$?

        echo "HTTP response code from Vault: $http_code"
        echo "Curl response code from Vault: $curl_response"

        if [ "$http_code" = "200" ] && [ "$curl_response" = "0" ]; then
            echo "Validation successful for: $3"
        else
            echo "Validation failed for: $3"
            exit 1
        fi
    fi
}

# Initialize HashiCorp Vault token
initHashicorpVaultToken() {
    # Retrieve the Kubernetes service account token
    KUBE_SA_TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
    # Request a Vault token using the Kubernetes authentication method
    RESPONSE=$(curl -sS --request POST "${VAULT_ADDR}/v1/auth/${KUBERNETES_AUTH_PATH}/login" -H "Content-Type: application/json" -d \
        '{"role":"'${VAULT_APP_ROLE}'","jwt":"'${KUBE_SA_TOKEN}'"}')
    # Print the Vault API response
    echo "Vault token API call response: $RESPONSE"

    # Extract error message (if any) from the response using jq
    ERROR=$(echo "$RESPONSE" | jq -r '.errors[0]')
    # Extract the Vault secret data from the response using jq
    export VAULT_TOKEN=$(echo "$RESPONSE" | jq -r '.auth.client_token')

    # Check if the Vault token is empty, null, or contains errors
    if [ -z "$VAULT_TOKEN" ] || [ "$VAULT_TOKEN" = "null" ] || echo "$VAULT_TOKEN" | grep -q "errors"; then
        echo "Error: Failed to obtain Vault token."
        echo "Error Details: $ERROR"
        exit 1
    else
        echo "Vault token successfully obtained."
    fi
}

# Read HashiCorp Vault secret
readHashicorpVaultSecret() {
    # Send a request to Vault API to read a secret
    RESPONSE=$(curl --header "X-Vault-Token: ${VAULT_TOKEN}" "${VAULT_ADDR}/v1/${1}")
    # Print the Vault API response
    echo "Vault read API call response: $RESPONSE"

    # Extract error message (if any) from the response using jq
    ERROR=$(echo "$RESPONSE" | jq -r '.errors[0]')
    # Extract the Vault secret data from the response using jq
    VAULT_SECRET=$(echo "$RESPONSE" | jq -r '.data.data')

    # Flag to indicate that secrets are present in the vault or not
    SECRETS_AVAILABLE="no"

    # Stop further execution of code if an error is found
    if [ -n "$ERROR" ] && [ "$ERROR" != "null" ]; then
        echo "Error: Failed to read Vault secret."
        echo "Error Details: $ERROR"
        exit 1
    else
        # Check if the Vault API response indicates a failure
        if [ -n "$VAULT_SECRET" ] && [ "$VAULT_SECRET" != "null" ] && ! echo "$VAULT_SECRET" | grep -q "errors"; then
            validateVaultResponseHashicorp "${1}" "LOOKUPSECRETRESPONSE" "read api call"
            echo "Successfully obtained Vault Secret from the path ${VAULT_ADDR}/v1/${1}"
            echo "Vault Secret: $VAULT_SECRET"
            SECRETS_AVAILABLE="yes"
        else
            echo "The secret is absent in the vault at path ${VAULT_ADDR}/v1/${1}"
            echo "NOTE: This is not an error; it indicates that the secret will be created in later code."
        fi
    fi
}

# Write a secret to the HashiCorp Vault
writeHashicorpVaultSecret() {
    # Send a request to Vault API to write a secret
    VAULT_RESPONSE=$(curl \
        -H "X-Vault-Token: ${VAULT_TOKEN}" \
        -H "Content-Type: application/json" \
        -X POST \
        -d @"${2}" \
        "${VAULT_ADDR}/v1/${1}")

    # Print the Vault API response
    echo "Vault write API call response: ${VAULT_RESPONSE}"

    # Stop further execution of code if an error is found
    # Check if the Vault API response indicates a failure
    if [ -z "$VAULT_RESPONSE" ] || [ "$VAULT_RESPONSE" = "null" ] || echo "$VAULT_RESPONSE" | grep -q "errors"; then
        echo "Error: Failed to write to Vault at path ${VAULT_ADDR}/v1/${1}"
        exit 1
    else
        validateVaultResponseHashicorp "${1}" "LOOKUPSECRETRESPONSE" "write api call"
        echo "Successfully wrote to Vault at path ${VAULT_ADDR}/v1/${1}"
    fi
}

# Read a Kubernetes secret and set VAULT_SECRET as JSON
readKubernetesSecret() {
    local secret_path="$1"
    # Convert vault-style path to K8s secret name
    # e.g. "secretsv2/data/crypto/peerOrganizations/cna-alpha/users/admin/msp" -> last two segments as secret name
    # The convention is: the secret name = <component>-<org>-msp or <component>-<org>-tls
    # But we need to derive it from the path. Bevel stores secrets with names like:
    #   admin-cna-alpha-msp, peer0-cna-alpha-tls, orderer0-tls, etc.

    local NAMESPACE=$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace 2>/dev/null || echo "${VAULT_NAMESPACE:-default}")

    # Extract the secret name from the path
    # Path patterns:
    #   .../users/admin/msp  -> admin-<org>-msp
    #   .../users/admin/tls  -> admin-<org>-tls
    #   .../orderer/tls      -> orderer0-tls (orderer tls root cert)
    #   .../peers/<peer>/msp -> <peer>-<org>-msp
    # We try to derive a K8s secret name from the path

    local secret_name=""
    local suffix=""

    # Detect suffix (last path component: msp or tls)
    if echo "$secret_path" | grep -q "/tls$"; then
        suffix="tls"
    elif echo "$secret_path" | grep -q "/msp$"; then
        suffix="msp"
    fi

    # Try to find org name from path
    local org=""
    if echo "$secret_path" | grep -q "peerOrganizations"; then
        org=$(echo "$secret_path" | sed -n 's|.*peerOrganizations/\([^/]*\)/.*|\1|p')
    elif echo "$secret_path" | grep -q "ordererOrganizations"; then
        org=$(echo "$secret_path" | sed -n 's|.*ordererOrganizations/\([^/]*\)/.*|\1|p')
    fi

    # Determine component (admin, peer0, orderer0, etc.)
    local component=""
    if echo "$secret_path" | grep -q "/users/admin"; then
        component="admin"
    elif echo "$secret_path" | grep -q "/orderer"; then
        # For orderer TLS path like .../peerOrganizations/cna-alpha/orderer/tls
        # This references orderer TLS root cert, stored as orderer-tls-rootcert or orderer0-tls
        if [ "$suffix" = "tls" ]; then
            # Try orderer-tls-rootcert first, then orderer0-tls
            for try_name in "orderer-tls-rootcert" "orderer0-tls"; do
                local try_secret=$(kubectl get secret "$try_name" --namespace "$NAMESPACE" -o json 2>/dev/null)
                if [ -n "$try_secret" ] && [ "$try_secret" != "" ]; then
                    VAULT_SECRET=$(echo "$try_secret" | jq -r '.data | to_entries | map({(.key): (.value | @base64d)}) | add')
                    SECRETS_AVAILABLE="yes"
                    echo "Successfully read K8s secret: $try_name in $NAMESPACE"
                    return
                fi
            done
        fi
        component="orderer0"
    fi

    # Build secret name
    if [ -n "$component" ] && [ -n "$org" ] && [ -n "$suffix" ]; then
        secret_name="${component}-${org}-${suffix}"
    elif [ -n "$component" ] && [ -n "$suffix" ]; then
        secret_name="${component}-${suffix}"
    else
        # Fallback: use last path segments
        secret_name=$(echo "$secret_path" | awk -F'/' '{print $(NF-1)"-"$NF}')
    fi

    echo "Looking up K8s secret: $secret_name in namespace $NAMESPACE"
    local K8S_SECRET=$(kubectl get secret "$secret_name" --namespace "$NAMESPACE" -o json 2>/dev/null)

    if [ -z "$K8S_SECRET" ] || [ "$K8S_SECRET" = "" ]; then
        echo "K8s secret $secret_name not found in $NAMESPACE"
        SECRETS_AVAILABLE="no"
        VAULT_SECRET=""
    else
        # Decode all base64 values and build a JSON object
        VAULT_SECRET=$(echo "$K8S_SECRET" | jq -r '.data | to_entries | map({(.key): (.value | @base64d)}) | add')
        SECRETS_AVAILABLE="yes"
        echo "Successfully read K8s secret: $secret_name in $NAMESPACE"
    fi
}

# Main function for Vault operations (supports hashicorp and kubernetes)
vaultBevelFunc() {
    if [ "$VAULT_TYPE" = "hashicorp" ]; then
        case $1 in
            "init")
                initHashicorpVaultToken
                ;;
            "readJson")
                readHashicorpVaultSecret "$2"
                ;;
            "write")
                writeHashicorpVaultSecret "$2" "$3"
                ;;
            *)
                echo "Invalid option"
                exit 1
                ;;
        esac
    elif [ "$VAULT_TYPE" = "kubernetes" ]; then
        case $1 in
            "init")
                echo "Kubernetes vault type: no token init needed"
                ;;
            "readJson")
                readKubernetesSecret "$2"
                ;;
            "write")
                echo "Kubernetes vault type: write not supported via script"
                ;;
            *)
                echo "Invalid option"
                exit 1
                ;;
        esac
    fi
}
