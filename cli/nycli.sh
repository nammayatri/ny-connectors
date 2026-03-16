#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# nycli — Namma Yatri CLI
# Book and manage rides from your terminal
# =============================================================================

VERSION="1.0.0"
API_BASE="${NY_API_BASE:-https://api.moving.tech/pilot/app/v2}"
TOKEN_DIR="$HOME/.namma-yatri"
TOKEN_FILE="$TOKEN_DIR/token.json"
POLL_INTERVAL=2
SEARCH_POLL_MAX=10
DRIVER_POLL_MAX=30
CLIENT_ID="ACP_CLI"

# =============================================================================
# Colors & Output
# =============================================================================

if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    DIM='\033[2m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' DIM='' NC=''
fi

info()  { printf "${BLUE}[info]${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}  ok  ${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${NC} %s\n" "$*" >&2; }
err()   { printf "${RED}[error]${NC} %s\n" "$*" >&2; }
header(){ printf "\n${BOLD}%s${NC}\n" "$*"; }

# =============================================================================
# JSON Utilities
# =============================================================================

HAS_JQ=false
if command -v jq >/dev/null 2>&1; then
    HAS_JQ=true
fi

json_get() {
    local json="$1" key="$2"
    if $HAS_JQ; then
        printf '%s' "$json" | jq -r ".$key // empty" 2>/dev/null
    else
        printf '%s' "$json" | sed -n 's/.*"'"$key"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1
    fi
}

json_pp() {
    if $HAS_JQ; then
        printf '%s' "$1" | jq . 2>/dev/null || printf '%s\n' "$1"
    else
        printf '%s\n' "$1"
    fi
}

json_length() {
    local json="$1" path="$2"
    if $HAS_JQ; then
        printf '%s' "$json" | jq "$path | length" 2>/dev/null
    else
        echo "0"
    fi
}

json_arr_field() {
    local json="$1" path="$2" idx="$3" field="$4"
    if $HAS_JQ; then
        printf '%s' "$json" | jq -r "${path}[${idx}].${field} // empty" 2>/dev/null
    else
        echo ""
    fi
}

# =============================================================================
# Error Message Extraction
# =============================================================================

extract_error_message() {
    local body="$1"
    if [ -z "$body" ]; then
        return 1
    fi

    if $HAS_JQ; then
        local msg
        msg=$(printf '%s' "$body" | jq -r '
            .message //
            .error //
            .errorMessage //
            .errorCode //
            empty
        ' 2>/dev/null)
        if [ -n "$msg" ]; then
            printf '%s' "$msg"
            return 0
        fi
    fi

    # Fallback: show raw body truncated to 200 characters
    printf '%s' "$body" | head -c 200
}

# =============================================================================
# Token Management
# =============================================================================

ensure_token_dir() {
    mkdir -p "$TOKEN_DIR"
}

read_token() {
    if [ -f "$TOKEN_FILE" ]; then
        json_get "$(cat "$TOKEN_FILE")" "token"
    fi
}

save_token() {
    local token="$1" saved_locations="${2:-[]}"
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    ensure_token_dir
    if $HAS_JQ; then
        jq -n \
            --arg token "$token" \
            --arg savedAt "$now" \
            --argjson savedLocations "$saved_locations" \
            --arg savedLocationsUpdatedAt "$now" \
            '{token:$token,savedAt:$savedAt,savedLocations:$savedLocations,savedLocationsUpdatedAt:$savedLocationsUpdatedAt}' \
            > "$TOKEN_FILE"
    else
        cat > "$TOKEN_FILE" <<EOF
{"token":"$token","savedAt":"$now","savedLocations":$saved_locations,"savedLocationsUpdatedAt":"$now"}
EOF
    fi
    chmod 600 "$TOKEN_FILE"
}

update_saved_locations() {
    local saved_locations="$1"
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    if $HAS_JQ && [ -f "$TOKEN_FILE" ]; then
        local tmp
        tmp=$(jq \
            --argjson sl "$saved_locations" \
            --arg ts "$now" \
            '.savedLocations = $sl | .savedLocationsUpdatedAt = $ts' \
            "$TOKEN_FILE")
        printf '%s' "$tmp" > "$TOKEN_FILE"
    fi
}

clear_token() {
    rm -f "$TOKEN_FILE"
    warn "Token cleared. Please re-authenticate with: nycli auth"
}

require_token() {
    local token
    token=$(read_token)
    if [ -z "$token" ]; then
        err "Not authenticated. Run 'nycli auth' first."
        exit 1
    fi
    printf '%s' "$token"
}

# =============================================================================
# HTTP / API
# =============================================================================

api_call() {
    local method="$1" endpoint="$2" body="${3:-}"
    local url="${API_BASE}${endpoint}"
    local token response http_code body_text

    token=$(read_token)

    local curl_args=(-s -w '\n%{http_code}' -X "$method" -H "Content-Type: application/json")

    if [ -n "$token" ]; then
        curl_args+=(-H "token: $token")
    fi

    if [ -n "$body" ] && [ "$method" = "POST" ]; then
        curl_args+=(-d "$body")
    fi

    response=$(curl "${curl_args[@]}" "$url") || {
        err "Network error: could not reach $url"
        exit 1
    }

    http_code=$(printf '%s' "$response" | tail -1)
    body_text=$(printf '%s' "$response" | sed '$d')

    case "$http_code" in
        2[0-9][0-9])
            printf '%s' "$body_text"
            return 0
            ;;
        401)
            clear_token
            err "Authentication failed (401). Token expired or invalid."
            err "Please re-authenticate: nycli auth"
            exit 1
            ;;
        *)
            err "API error: HTTP $http_code on $method $endpoint"
            if [ -n "$body_text" ]; then
                if $HAS_JQ; then
                    printf '%s' "$body_text" | jq . 2>/dev/null >&2 || printf '%s\n' "$body_text" >&2
                else
                    printf '%s\n' "$body_text" >&2
                fi
            fi
            return 1
            ;;
    esac
}

api_call_raw() {
    local method="$1" endpoint="$2" body="${3:-}"
    local url="${API_BASE}${endpoint}"
    local token response http_code body_text

    token=$(read_token)

    local curl_args=(-s -w '\n%{http_code}' -X "$method" -H "Content-Type: application/json")

    if [ -n "$token" ]; then
        curl_args+=(-H "token: $token")
    fi

    if [ -n "$body" ] && [ "$method" = "POST" ]; then
        curl_args+=(-d "$body")
    fi

    response=$(curl "${curl_args[@]}" "$url") || {
        err "Network error: could not reach $url"
        exit 1
    }

    http_code=$(printf '%s' "$response" | tail -1)
    body_text=$(printf '%s' "$response" | sed '$d')

    # Handle 401 globally — auth failures apply everywhere
    if [ "$http_code" = "401" ]; then
        clear_token
        err "Authentication failed (401). Token expired or invalid."
        err "Please re-authenticate: nycli auth"
        exit 1
    fi

    # Return status code and body to caller (separated by newline)
    printf '%s\n%s' "$http_code" "$body_text"

    case "$http_code" in
        2[0-9][0-9]) return 0 ;;
        *)           return 1 ;;
    esac
}

# =============================================================================
# Polling
# =============================================================================

poll_search_results() {
    local search_id="$1"
    local start_time elapsed response count

    start_time=$(date +%s)

    while true; do
        elapsed=$(( $(date +%s) - start_time ))
        if [ "$elapsed" -ge "$SEARCH_POLL_MAX" ]; then
            warn "Polling timeout after ${SEARCH_POLL_MAX}s — no estimates found."
            return 1
        fi

        info "Polling for estimates... (${elapsed}s)" >&2
        response=$(api_call GET "/rideSearch/${search_id}/results") || return 1

        count=$(json_length "$response" ".estimates")
        if [ "$count" -gt 0 ] 2>/dev/null; then
            printf '%s' "$response"
            return 0
        fi

        sleep "$POLL_INTERVAL"
    done
}

poll_driver_assignment() {
    local start_time elapsed response count

    start_time=$(date +%s)

    while true; do
        elapsed=$(( $(date +%s) - start_time ))
        if [ "$elapsed" -ge "$DRIVER_POLL_MAX" ]; then
            warn "No driver assigned after ${DRIVER_POLL_MAX}s."
            info "You'll receive a notification on your phone when a driver is assigned." >&2
            return 1
        fi

        info "Waiting for driver... (${elapsed}s)" >&2
        response=$(api_call GET "/rideBooking/list?onlyActive=true&clientId=${CLIENT_ID}") || return 1

        count=$(json_length "$response" ".list")
        if [ "$count" -gt 0 ] 2>/dev/null; then
            printf '%s' "$response"
            return 0
        fi

        sleep "$POLL_INTERVAL"
    done
}

# =============================================================================
# Commands
# =============================================================================

cmd_auth() {
    local mobile="" code="" country="IN"

    while [ $# -gt 0 ]; do
        case "$1" in
            --mobile)   mobile="$2"; shift 2 ;;
            --code)     code="$2"; shift 2 ;;
            --country)  country="$2"; shift 2 ;;
            *)          err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$mobile" ]; then
        printf "${CYAN}Mobile number: ${NC}"
        read -r mobile
    fi
    if [ -z "$code" ]; then
        printf "${CYAN}Access code: ${NC}"
        read -r code
    fi

    info "Authenticating..."

    local body
    body=$(printf '{"appSecretCode":"%s","userMobileNo":"%s"}' "$code" "$mobile")

    local response
    response=$(api_call POST "/auth/get-token" "$body") || exit 1

    local token
    token=$(json_get "$response" "token")

    if [ -z "$token" ]; then
        err "Authentication failed — no token in response."
        json_pp "$response" >&2
        exit 1
    fi

    # Fetch saved locations
    local saved_locations="[]"
    info "Fetching saved locations..."
    local sl_response
    if sl_response=$(curl -s -H "Content-Type: application/json" -H "token: $token" "${API_BASE}/savedLocation/list"); then
        if $HAS_JQ; then
            saved_locations=$(printf '%s' "$sl_response" | jq '.list // []' 2>/dev/null || echo "[]")
        fi
    fi

    save_token "$token" "$saved_locations"

    local person_name
    person_name=$(json_get "$response" "firstName")
    local sl_count
    if $HAS_JQ; then
        sl_count=$(printf '%s' "$saved_locations" | jq 'length' 2>/dev/null || echo "0")
    else
        sl_count="?"
    fi

    ok "Authenticated${person_name:+ as $person_name}"
    ok "Token saved to $TOKEN_FILE"
    ok "$sl_count saved location(s) cached"
}

cmd_places() {
    if [ $# -eq 0 ]; then
        err "Usage: nycli places <search text>"
        exit 1
    fi

    require_token >/dev/null

    local search_text="$*"
    local body
    body=$(printf '{
        "autoCompleteType":"DROP",
        "input":"%s",
        "language":"ENGLISH",
        "location":"12.97413032560963,77.58534937018615",
        "radius":50000,
        "radiusWithUnit":{"unit":"Meter","value":50000.0},
        "strictbounds":false
    }' "$search_text")

    info "Searching for \"$search_text\"..."

    local response
    response=$(api_call POST "/maps/autoComplete" "$body") || exit 1

    local count
    count=$(json_length "$response" ".predictions")

    if [ "$count" -eq 0 ] 2>/dev/null; then
        warn "No places found matching \"$search_text\""
        return 0
    fi

    header "Found $count place(s):"
    echo ""

    if $HAS_JQ; then
        local i=0
        while [ "$i" -lt "$count" ]; do
            local desc place_id dist
            desc=$(json_arr_field "$response" ".predictions" "$i" "description")
            place_id=$(json_arr_field "$response" ".predictions" "$i" "placeId")
            dist=$(printf '%s' "$response" | jq -r ".predictions[$i].distanceWithUnit.value // empty" 2>/dev/null)
            local dist_unit
            dist_unit=$(printf '%s' "$response" | jq -r ".predictions[$i].distanceWithUnit.unit // empty" 2>/dev/null)

            printf "  ${BOLD}%d.${NC} %s\n" $((i+1)) "$desc"
            printf "     ${DIM}Place ID: %s${NC}\n" "$place_id"
            if [ -n "$dist" ]; then
                printf "     ${DIM}Distance: %s %s${NC}\n" "$dist" "$dist_unit"
            fi
            echo ""
            i=$((i+1))
        done
    else
        json_pp "$response"
    fi
}

cmd_place_details() {
    require_token >/dev/null

    local place_id="" lat="" lon=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --place-id) place_id="$2"; shift 2 ;;
            --lat)      lat="$2"; shift 2 ;;
            --lon)      lon="$2"; shift 2 ;;
            *)          err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    local body
    if [ -n "$lat" ] && [ -n "$lon" ]; then
        body=$(printf '{
            "getBy":{"contents":{"lat":%s,"lon":%s},"tag":"ByLatLong"},
            "language":"ENGLISH",
            "sessionToken":"default-token"
        }' "$lat" "$lon")
    elif [ -n "$place_id" ]; then
        body=$(printf '{
            "getBy":{"contents":"%s","tag":"ByPlaceId"},
            "language":"ENGLISH",
            "sessionToken":"default-token"
        }' "$place_id")
    else
        err "Usage: nycli place-details --place-id <id>  OR  --lat <lat> --lon <lon>"
        exit 1
    fi

    info "Fetching place details..."

    local response
    response=$(api_call POST "/maps/getPlaceName" "$body") || exit 1

    if $HAS_JQ; then
        local r_lat r_lon r_place_id r_area r_city r_state
        r_lat=$(json_get "$response" "lat")
        r_lon=$(json_get "$response" "lon")
        r_place_id=$(json_get "$response" "placeId")
        r_area=$(printf '%s' "$response" | jq -r '.address.area // empty' 2>/dev/null)
        r_city=$(printf '%s' "$response" | jq -r '.address.city // empty' 2>/dev/null)
        r_state=$(printf '%s' "$response" | jq -r '.address.state // empty' 2>/dev/null)

        header "Place Details"
        echo ""
        printf "  ${BOLD}Coordinates:${NC} %s, %s\n" "$r_lat" "$r_lon"
        printf "  ${BOLD}Place ID:${NC}    %s\n" "$r_place_id"
        local addr_parts=""
        [ -n "$r_area" ] && addr_parts="$r_area"
        [ -n "$r_city" ] && addr_parts="${addr_parts:+$addr_parts, }$r_city"
        [ -n "$r_state" ] && addr_parts="${addr_parts:+$addr_parts, }$r_state"
        if [ -n "$addr_parts" ]; then
            printf "  ${BOLD}Address:${NC}     %s\n" "$addr_parts"
        fi
        echo ""
        printf "  ${DIM}Full response:${NC}\n"
        json_pp "$response" | sed 's/^/  /'
    else
        json_pp "$response"
    fi
}

cmd_search() {
    require_token >/dev/null

    local from_lat="" from_lon="" to_lat="" to_lon=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --from-lat) from_lat="$2"; shift 2 ;;
            --from-lon) from_lon="$2"; shift 2 ;;
            --to-lat)   to_lat="$2"; shift 2 ;;
            --to-lon)   to_lon="$2"; shift 2 ;;
            *)          err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$from_lat" ] || [ -z "$from_lon" ] || [ -z "$to_lat" ] || [ -z "$to_lon" ]; then
        err "Usage: nycli search --from-lat <lat> --from-lon <lon> --to-lat <lat> --to-lon <lon>"
        exit 1
    fi

    local body
    body=$(printf '{
        "contents":{
            "origin":{
                "gps":{"lat":%s,"lon":%s},
                "address":{"area":"%s,%s","city":"","country":"","building":"","placeId":"%s,%s","state":""}
            },
            "destination":{
                "gps":{"lat":%s,"lon":%s},
                "address":{"area":"%s,%s","city":"","country":"","building":"","placeId":"%s,%s","state":""}
            },
            "placeNameSource":"API_CLI",
            "platformType":"APPLICATION"
        },
        "fareProductType":"ONE_WAY"
    }' "$from_lat" "$from_lon" "$from_lat" "$from_lon" "$from_lat" "$from_lon" \
       "$to_lat" "$to_lon" "$to_lat" "$to_lon" "$to_lat" "$to_lon")

    info "Searching for rides..."

    local response
    response=$(api_call POST "/rideSearch" "$body") || exit 1

    local search_id
    search_id=$(json_get "$response" "searchId")

    if [ -z "$search_id" ]; then
        err "No searchId in response"
        json_pp "$response" >&2
        exit 1
    fi

    ok "Search ID: $search_id"

    local results
    results=$(poll_search_results "$search_id") || {
        warn "No estimates returned. Try different locations or try again later."
        exit 1
    }

    local count
    count=$(json_length "$results" ".estimates")
    header "Found $count estimate(s):"
    echo ""

    if $HAS_JQ; then
        local i=0
        while [ "$i" -lt "$count" ]; do
            local e_id e_fare e_currency e_vehicle e_tier e_pickup e_provider e_min e_max
            e_id=$(json_arr_field "$results" ".estimates" "$i" "id")
            e_fare=$(printf '%s' "$results" | jq -r ".estimates[$i].estimatedTotalFareWithCurrency | \"\(.currency) \(.amount)\"" 2>/dev/null)
            e_vehicle=$(json_arr_field "$results" ".estimates" "$i" "vehicleVariant")
            e_tier=$(json_arr_field "$results" ".estimates" "$i" "serviceTierName")
            e_pickup=$(json_arr_field "$results" ".estimates" "$i" "estimatedPickupDuration")
            e_provider=$(json_arr_field "$results" ".estimates" "$i" "providerName")
            e_min=$(printf '%s' "$results" | jq -r ".estimates[$i].totalFareRange.minFare // empty" 2>/dev/null)
            e_max=$(printf '%s' "$results" | jq -r ".estimates[$i].totalFareRange.maxFare // empty" 2>/dev/null)

            printf "  ${BOLD}%d.${NC} ${CYAN}%s${NC} (%s)\n" $((i+1)) "$e_tier" "$e_vehicle"
            printf "     Fare: ${GREEN}%s${NC}" "$e_fare"
            if [ -n "$e_min" ] && [ -n "$e_max" ]; then
                printf " (range: %s-%s)" "$e_min" "$e_max"
            fi
            echo ""
            if [ -n "$e_pickup" ]; then
                printf "     Pickup ETA: %ss\n" "$e_pickup"
            fi
            printf "     Provider: %s\n" "$e_provider"
            printf "     ${DIM}Estimate ID: %s${NC}\n" "$e_id"
            echo ""
            i=$((i+1))
        done
    else
        json_pp "$results"
    fi
}

cmd_select() {
    require_token >/dev/null

    local estimate_id="" also="" pet="false" special="true"

    while [ $# -gt 0 ]; do
        case "$1" in
            --estimate-id) estimate_id="$2"; shift 2 ;;
            --also)        also="$2"; shift 2 ;;
            --pet)         pet="true"; shift ;;
            --special-assistance) special="false"; shift ;;
            *)             err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$estimate_id" ]; then
        err "Usage: nycli select --estimate-id <id> [--also <id2,id3>] [--pet] [--special-assistance]"
        exit 1
    fi

    # Build otherSelectedEstimates array
    local other_json="[]"
    if [ -n "$also" ]; then
        if $HAS_JQ; then
            other_json=$(printf '%s' "$also" | tr ',' '\n' | jq -R . | jq -s .)
        else
            other_json="[$(printf '%s' "$also" | sed 's/,/","/g' | sed 's/^/"/;s/$/"/' )]"
        fi
    fi

    local body
    body=$(printf '{
        "autoAssignEnabled":true,
        "autoAssignEnabledV2":true,
        "paymentMethodId":"",
        "otherSelectedEstimates":%s,
        "disabilityDisable":%s,
        "isPetRide":%s
    }' "$other_json" "$special" "$pet")

    info "Selecting estimate $estimate_id..."

    api_call POST "/estimate/${estimate_id}/select2" "$body" >/dev/null || exit 1

    ok "Estimate selected."

    info "Polling for driver assignment..."
    local result
    if result=$(poll_driver_assignment); then
        header "Driver Assigned!"
        if $HAS_JQ; then
            local ride
            ride=$(printf '%s' "$result" | jq '.list[0]' 2>/dev/null)
            local r_id r_status r_driver r_vehicle r_fare
            r_id=$(printf '%s' "$ride" | jq -r '.id // empty' 2>/dev/null)
            r_status=$(printf '%s' "$ride" | jq -r '.status // empty' 2>/dev/null)
            r_driver=$(printf '%s' "$ride" | jq -r '.driverName // empty' 2>/dev/null)
            r_vehicle=$(printf '%s' "$ride" | jq -r '.vehicleNumber // empty' 2>/dev/null)
            r_fare=$(printf '%s' "$ride" | jq -r '.estimatedFare // empty' 2>/dev/null)

            echo ""
            printf "  ${BOLD}Booking ID:${NC} %s\n" "$r_id"
            printf "  ${BOLD}Status:${NC}     %s\n" "$r_status"
            [ -n "$r_driver" ] && printf "  ${BOLD}Driver:${NC}     %s\n" "$r_driver"
            [ -n "$r_vehicle" ] && printf "  ${BOLD}Vehicle:${NC}    %s\n" "$r_vehicle"
            [ -n "$r_fare" ] && printf "  ${BOLD}Fare:${NC}       %s\n" "$r_fare"
            echo ""
        else
            json_pp "$result"
        fi
    fi
}

cmd_tip() {
    require_token >/dev/null

    local estimate_id="" amount="" currency="INR"

    while [ $# -gt 0 ]; do
        case "$1" in
            --estimate-id) estimate_id="$2"; shift 2 ;;
            --amount)      amount="$2"; shift 2 ;;
            --currency)    currency="$2"; shift 2 ;;
            *)             err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$estimate_id" ] || [ -z "$amount" ]; then
        err "Usage: nycli tip --estimate-id <id> --amount <number> [--currency INR]"
        exit 1
    fi

    local body
    body=$(printf '{
        "autoAssignEnabled":true,
        "autoAssignEnabledV2":true,
        "paymentMethodId":"",
        "customerExtraFeeWithCurrency":{"amount":%s,"currency":"%s"},
        "customerExtraFee":%s,
        "otherSelectedEstimates":[],
        "disabilityDisable":true,
        "isPetRide":false
    }' "$amount" "$currency" "$amount")

    info "Adding tip of $currency $amount to estimate $estimate_id..."

    api_call POST "/estimate/${estimate_id}/select2" "$body" >/dev/null || exit 1

    ok "Tip added and estimate selected."
}

cmd_cancel() {
    require_token >/dev/null

    local estimate_id=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --estimate-id) estimate_id="$2"; shift 2 ;;
            *)             err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$estimate_id" ]; then
        err "Usage: nycli cancel --estimate-id <id>"
        exit 1
    fi

    info "Cancelling estimate $estimate_id..."

    local raw_response http_code body_text api_msg
    raw_response=$(api_call_raw POST "/estimate/${estimate_id}/cancelSearch" '{}') || {
        http_code=$(printf '%s' "$raw_response" | head -1)
        body_text=$(printf '%s' "$raw_response" | tail -n +2)
        api_msg=$(extract_error_message "$body_text")

        case "$http_code" in
            400)
                err "Bad request: the estimate ID may be malformed or the request is invalid."
                [ -n "$api_msg" ] && err "Server says: $api_msg"
                ;;
            404)
                err "Estimate not found: '$estimate_id' does not exist or has already expired."
                [ -n "$api_msg" ] && err "Server says: $api_msg"
                ;;
            409)
                err "Conflict: this estimate has already been cancelled or is in a state that cannot be cancelled."
                [ -n "$api_msg" ] && err "Server says: $api_msg"
                ;;
            *)
                err "API error: HTTP $http_code on POST /estimate/${estimate_id}/cancelSearch"
                if [ -n "$body_text" ]; then
                    if $HAS_JQ; then
                        printf '%s' "$body_text" | jq . 2>/dev/null >&2 || printf '%s\n' "$body_text" >&2
                    else
                        printf '%s\n' "$body_text" >&2
                    fi
                fi
                ;;
        esac
        return 1
    }

    ok "Search cancelled."
}

cmd_status() {
    require_token >/dev/null

    local active="true" limit="" offset=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --active)   active="true"; shift ;;
            --all)      active="false"; shift ;;
            --limit)    limit="$2"; shift 2 ;;
            --offset)   offset="$2"; shift 2 ;;
            *)          err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    local params="onlyActive=${active}&clientId=${CLIENT_ID}"
    [ -n "$limit" ] && params="${params}&limit=${limit}"
    [ -n "$offset" ] && params="${params}&offset=${offset}"

    info "Fetching ride status..."

    local response
    response=$(api_call GET "/rideBooking/list?${params}") || exit 1

    local count
    count=$(json_length "$response" ".list")

    if [ "$count" -eq 0 ] 2>/dev/null; then
        info "No rides found."
        return 0
    fi

    header "$count ride(s):"
    echo ""

    if $HAS_JQ; then
        local i=0
        while [ "$i" -lt "$count" ]; do
            local r_id r_status r_created r_fare r_driver r_vehicle r_variant
            r_id=$(json_arr_field "$response" ".list" "$i" "id")
            r_status=$(json_arr_field "$response" ".list" "$i" "status")
            r_created=$(json_arr_field "$response" ".list" "$i" "createdAt")
            r_fare=$(json_arr_field "$response" ".list" "$i" "estimatedFare")
            r_driver=$(json_arr_field "$response" ".list" "$i" "driverName")
            r_vehicle=$(json_arr_field "$response" ".list" "$i" "vehicleNumber")
            r_variant=$(json_arr_field "$response" ".list" "$i" "vehicleVariant")

            local status_color="$NC"
            case "$r_status" in
                *COMPLETED*) status_color="$GREEN" ;;
                *CANCELLED*) status_color="$RED" ;;
                *ACTIVE*|*NEW*|*CONFIRMED*) status_color="$YELLOW" ;;
            esac

            printf "  ${BOLD}%d.${NC} ${status_color}%s${NC}\n" $((i+1)) "$r_status"
            printf "     Created: %s\n" "$r_created"
            [ -n "$r_fare" ] && printf "     Fare: %s\n" "$r_fare"
            [ -n "$r_driver" ] && printf "     Driver: %s\n" "$r_driver"
            [ -n "$r_vehicle" ] && printf "     Vehicle: %s (%s)\n" "$r_vehicle" "$r_variant"
            printf "     ${DIM}Booking ID: %s${NC}\n" "$r_id"
            echo ""
            i=$((i+1))
        done
    else
        json_pp "$response"
    fi
}

cmd_saved_locations() {
    require_token >/dev/null

    info "Fetching saved locations..."

    local response
    response=$(api_call GET "/savedLocation/list") || exit 1

    local count
    count=$(json_length "$response" ".list")

    if [ "$count" -eq 0 ] 2>/dev/null; then
        info "No saved locations found."
        update_saved_locations "[]"
        return 0
    fi

    header "$count saved location(s):"
    echo ""

    if $HAS_JQ; then
        local locations
        locations=$(printf '%s' "$response" | jq '.list // []' 2>/dev/null)
        update_saved_locations "$locations"

        local i=0
        while [ "$i" -lt "$count" ]; do
            local s_tag s_lat s_lon s_name s_area s_city
            s_tag=$(json_arr_field "$response" ".list" "$i" "tag")
            s_lat=$(json_arr_field "$response" ".list" "$i" "lat")
            s_lon=$(json_arr_field "$response" ".list" "$i" "lon")
            s_name=$(json_arr_field "$response" ".list" "$i" "locationName")
            s_area=$(json_arr_field "$response" ".list" "$i" "area")
            s_city=$(json_arr_field "$response" ".list" "$i" "city")

            printf "  ${BOLD}%d.${NC} ${CYAN}%s${NC}" $((i+1)) "$s_tag"
            [ -n "$s_name" ] && printf " — %s" "$s_name"
            echo ""
            local addr=""
            [ -n "$s_area" ] && addr="$s_area"
            [ -n "$s_city" ] && addr="${addr:+$addr, }$s_city"
            [ -n "$addr" ] && printf "     Address: %s\n" "$addr"
            printf "     Coordinates: %s, %s\n" "$s_lat" "$s_lon"
            echo ""
            i=$((i+1))
        done

        ok "Saved locations cache updated."
    else
        json_pp "$response"
    fi
}

cmd_cancellation_reasons() {
    require_token >/dev/null

    local stage=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --stage) stage="$2"; shift 2 ;;
            *)       err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$stage" ]; then
        err "Usage: nycli cancellation-reasons --stage <OnSearch|OnInit|OnConfirm|OnAssign>"
        exit 1
    fi

    info "Fetching cancellation reasons for stage: $stage..."

    local response
    response=$(api_call GET "/cancellationReason/list?cancellationStage=${stage}") || exit 1

    local count
    count=$(json_length "$response" ".")

    if [ "$count" -eq 0 ] 2>/dev/null; then
        info "No cancellation reasons found for stage \"$stage\"."
        return 0
    fi

    header "$count cancellation reason(s) for stage \"$stage\":"
    echo ""

    if $HAS_JQ; then
        local i=0
        while [ "$i" -lt "$count" ]; do
            local r_code r_desc
            r_code=$(json_arr_field "$response" "." "$i" "reasonCode")
            r_desc=$(json_arr_field "$response" "." "$i" "description")

            printf "  ${BOLD}%d.${NC} ${CYAN}%s${NC} — %s\n" $((i+1)) "$r_code" "$r_desc"
            i=$((i+1))
        done
        echo ""
    else
        json_pp "$response"
    fi
}

cmd_cancel_booking() {
    require_token >/dev/null

    local booking_id="" reason_code="" reason_stage="" additional_info="" reallocate=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --booking-id)      booking_id="$2"; shift 2 ;;
            --reason-code)     reason_code="$2"; shift 2 ;;
            --reason-stage)    reason_stage="$2"; shift 2 ;;
            --additional-info) additional_info="$2"; shift 2 ;;
            --reallocate)      reallocate="true"; shift ;;
            *)                 err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$booking_id" ] || [ -z "$reason_code" ] || [ -z "$reason_stage" ]; then
        err "Usage: nycli cancel-booking --booking-id <id> --reason-code <code> --reason-stage <stage>"
        err "  Optional: --additional-info <text> --reallocate"
        exit 1
    fi

    local body
    if $HAS_JQ; then
        body=$(jq -n \
            --arg rc "$reason_code" \
            --arg rs "$reason_stage" \
            '{reasonCode:$rc,reasonStage:$rs}')
        if [ -n "$additional_info" ]; then
            body=$(printf '%s' "$body" | jq --arg ai "$additional_info" '. + {additionalInfo:$ai}')
        fi
        if [ "$reallocate" = "true" ]; then
            body=$(printf '%s' "$body" | jq '. + {reallocate:true}')
        fi
    else
        body=$(printf '{"reasonCode":"%s","reasonStage":"%s"' "$reason_code" "$reason_stage")
        if [ -n "$additional_info" ]; then
            body="${body},\"additionalInfo\":\"$additional_info\""
        fi
        if [ "$reallocate" = "true" ]; then
            body="${body},\"reallocate\":true"
        fi
        body="${body}}"
    fi

    info "Cancelling booking $booking_id..."

    api_call POST "/rideBooking/${booking_id}/cancel" "$body" >/dev/null || exit 1

    ok "Booking cancelled."
}

cmd_booking_details() {
    require_token >/dev/null

    local booking_id=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --booking-id) booking_id="$2"; shift 2 ;;
            *)            err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$booking_id" ]; then
        err "Usage: nycli booking-details --booking-id <id>"
        exit 1
    fi

    info "Fetching booking details..."

    local response
    response=$(api_call GET "/rideBooking/v2/${booking_id}") || exit 1

    if $HAS_JQ; then
        local b_id b_status b_ride_status b_safety b_driver_arrival
        b_id=$(json_get "$response" "id")
        b_status=$(json_get "$response" "bookingStatus")
        b_ride_status=$(json_get "$response" "rideStatus")
        b_safety=$(printf '%s' "$response" | jq -r '.isSafetyPlus // empty' 2>/dev/null)
        b_driver_arrival=$(json_get "$response" "driverArrivalTime")

        local status_color="$NC"
        case "$b_status" in
            *COMPLETED*) status_color="$GREEN" ;;
            *CANCELLED*) status_color="$RED" ;;
            *CONFIRMED*|*TRIP_ASSIGNED*) status_color="$YELLOW" ;;
        esac

        header "Booking Details"
        echo ""
        printf "  ${BOLD}Booking ID:${NC}     %s\n" "$b_id"
        printf "  ${BOLD}Booking Status:${NC} ${status_color}%s${NC}\n" "$b_status"
        [ -n "$b_ride_status" ] && printf "  ${BOLD}Ride Status:${NC}    %s\n" "$b_ride_status"
        [ -n "$b_driver_arrival" ] && printf "  ${BOLD}Driver Arrival:${NC} %s\n" "$b_driver_arrival"
        [ -n "$b_safety" ] && printf "  ${BOLD}Safety Plus:${NC}    %s\n" "$b_safety"
        echo ""
        printf "  ${DIM}Full response:${NC}\n"
        json_pp "$response" | sed 's/^/  /'
    else
        json_pp "$response"
    fi
}

cmd_ride_status() {
    require_token >/dev/null

    local ride_id=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --ride-id) ride_id="$2"; shift 2 ;;
            *)         err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$ride_id" ]; then
        err "Usage: nycli ride-status --ride-id <id>"
        exit 1
    fi

    info "Fetching ride status..."

    local response
    response=$(api_call GET "/ride/${ride_id}/status") || exit 1

    if $HAS_JQ; then
        local r_id r_status r_otp r_driver r_driver_num r_vehicle r_model r_color
        local r_start r_end r_price r_lat r_lon
        r_id=$(printf '%s' "$response" | jq -r '.ride.id // empty' 2>/dev/null)
        r_status=$(printf '%s' "$response" | jq -r '.ride.status // empty' 2>/dev/null)
        r_otp=$(printf '%s' "$response" | jq -r '.ride.rideOtp // empty' 2>/dev/null)
        r_driver=$(printf '%s' "$response" | jq -r '.ride.driverName // empty' 2>/dev/null)
        r_driver_num=$(printf '%s' "$response" | jq -r '.ride.driverNumber // empty' 2>/dev/null)
        r_vehicle=$(printf '%s' "$response" | jq -r '.ride.vehicleNumber // empty' 2>/dev/null)
        r_model=$(printf '%s' "$response" | jq -r '.ride.vehicleModel // empty' 2>/dev/null)
        r_color=$(printf '%s' "$response" | jq -r '.ride.vehicleColor // empty' 2>/dev/null)
        r_start=$(printf '%s' "$response" | jq -r '.ride.rideStartTime // empty' 2>/dev/null)
        r_end=$(printf '%s' "$response" | jq -r '.ride.rideEndTime // empty' 2>/dev/null)
        r_price=$(printf '%s' "$response" | jq -r '.ride.computedPriceWithCurrency | "\(.currency) \(.amount)"' 2>/dev/null)
        r_lat=$(printf '%s' "$response" | jq -r '.driverPosition.lat // empty' 2>/dev/null)
        r_lon=$(printf '%s' "$response" | jq -r '.driverPosition.lon // empty' 2>/dev/null)

        local status_color="$NC"
        case "$r_status" in
            COMPLETED) status_color="$GREEN" ;;
            CANCELLED) status_color="$RED" ;;
            INPROGRESS|NEW) status_color="$YELLOW" ;;
        esac

        header "Ride Status"
        echo ""
        printf "  ${BOLD}Ride ID:${NC}    %s\n" "$r_id"
        printf "  ${BOLD}Status:${NC}     ${status_color}%s${NC}\n" "$r_status"
        [ -n "$r_otp" ] && printf "  ${BOLD}OTP:${NC}        %s\n" "$r_otp"
        [ -n "$r_driver" ] && printf "  ${BOLD}Driver:${NC}     %s\n" "$r_driver"
        [ -n "$r_driver_num" ] && printf "  ${BOLD}Phone:${NC}      %s\n" "$r_driver_num"
        [ -n "$r_vehicle" ] && printf "  ${BOLD}Vehicle:${NC}    %s %s (%s)\n" "$r_color" "$r_model" "$r_vehicle"
        [ -n "$r_start" ] && printf "  ${BOLD}Start:${NC}      %s\n" "$r_start"
        [ -n "$r_end" ] && printf "  ${BOLD}End:${NC}        %s\n" "$r_end"
        [ -n "$r_price" ] && [ "$r_price" != "null null" ] && printf "  ${BOLD}Price:${NC}      %s\n" "$r_price"
        if [ -n "$r_lat" ] && [ -n "$r_lon" ]; then
            echo ""
            printf "  ${BOLD}Driver Position:${NC} %s, %s\n" "$r_lat" "$r_lon"
        fi
        echo ""
    else
        json_pp "$response"
    fi
}

cmd_post_tip() {
    require_token >/dev/null

    local ride_id="" amount="" currency="INR"

    while [ $# -gt 0 ]; do
        case "$1" in
            --ride-id)   ride_id="$2"; shift 2 ;;
            --amount)    amount="$2"; shift 2 ;;
            --currency)  currency="$2"; shift 2 ;;
            *)           err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$ride_id" ] || [ -z "$amount" ]; then
        err "Usage: nycli post-tip --ride-id <id> --amount <number> [--currency INR]"
        exit 1
    fi

    local body
    body=$(printf '{"amount":{"amount":%s,"currency":"%s"}}' "$amount" "$currency")

    info "Adding post-ride tip of $currency $amount to ride $ride_id..."

    api_call POST "/payment/${ride_id}/addTip" "$body" >/dev/null || exit 1

    ok "Post-ride tip added."
}

cmd_price_breakdown() {
    require_token >/dev/null

    local booking_id=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --booking-id) booking_id="$2"; shift 2 ;;
            *)            err "Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [ -z "$booking_id" ]; then
        err "Usage: nycli price-breakdown --booking-id <id>"
        exit 1
    fi

    info "Fetching price breakdown..."

    local response
    response=$(api_call GET "/priceBreakup?bookingId=${booking_id}") || exit 1

    local count
    count=$(json_length "$response" ".quoteBreakup")

    if [ "$count" -eq 0 ] 2>/dev/null; then
        info "No price breakdown available for this booking."
        return 0
    fi

    header "Fare Breakdown:"
    echo ""

    if $HAS_JQ; then
        local i=0
        while [ "$i" -lt "$count" ]; do
            local title amount_val amount_currency
            title=$(json_arr_field "$response" ".quoteBreakup" "$i" "title")
            amount_val=$(printf '%s' "$response" | jq -r ".quoteBreakup[$i].priceWithCurrency.amount // empty" 2>/dev/null)
            amount_currency=$(printf '%s' "$response" | jq -r ".quoteBreakup[$i].priceWithCurrency.currency // empty" 2>/dev/null)

            printf "  ${BOLD}%-25s${NC} ${GREEN}%s %s${NC}\n" "$title" "$amount_currency" "$amount_val"
            i=$((i+1))
        done
        echo ""
    else
        json_pp "$response"
    fi
}

# =============================================================================
# Help
# =============================================================================

cmd_help() {
    cat <<HELPEOF

${BOLD}nycli${NC} v${VERSION} — Namma Yatri CLI

${BOLD}USAGE${NC}
    nycli <command> [options]

${BOLD}COMMANDS${NC}
    ${CYAN}auth${NC}               Authenticate with Namma Yatri
    ${CYAN}places${NC}             Search for places (autocomplete)
    ${CYAN}place-details${NC}      Get place coordinates and address
    ${CYAN}search${NC}             Search for available rides
    ${CYAN}select${NC}             Select an estimate to book
    ${CYAN}tip${NC}                Add a tip and select estimate
    ${CYAN}cancel${NC}             Cancel an active search
    ${CYAN}status${NC}             Check ride booking status
    ${CYAN}saved-locations${NC}    List saved locations (Home, Work, etc.)
    ${CYAN}cancellation-reasons${NC} List valid cancellation reasons for a stage
    ${CYAN}cancel-booking${NC}     Cancel a confirmed ride booking
    ${CYAN}booking-details${NC}    Get full details of a specific booking
    ${CYAN}ride-status${NC}        Get real-time status of an active ride
    ${CYAN}post-tip${NC}           Add a tip after a completed ride
    ${CYAN}price-breakdown${NC}    Show detailed fare breakdown
    ${CYAN}help${NC}               Show this help
    ${CYAN}version${NC}            Show version

${BOLD}EXAMPLES${NC}
    ${DIM}# Authenticate${NC}
    nycli auth --mobile 9876543210 --code YOUR_ACCESS_CODE

    ${DIM}# Search for a place${NC}
    nycli places "Koramangala"

    ${DIM}# Get place coordinates${NC}
    nycli place-details --place-id "ChIJx9..."

    ${DIM}# Search for rides${NC}
    nycli search --from-lat 12.935 --from-lon 77.624 --to-lat 12.971 --to-lon 77.594

    ${DIM}# Select an estimate${NC}
    nycli select --estimate-id "abc-123"

    ${DIM}# Select multiple estimates${NC}
    nycli select --estimate-id "abc-123" --also "def-456,ghi-789"

    ${DIM}# Add a tip${NC}
    nycli tip --estimate-id "abc-123" --amount 20

    ${DIM}# Cancel a search${NC}
    nycli cancel --estimate-id "abc-123"

    ${DIM}# Check active rides${NC}
    nycli status --active

    ${DIM}# All rides${NC}
    nycli status --all

    ${DIM}# List cancellation reasons${NC}
    nycli cancellation-reasons --stage OnConfirm

    ${DIM}# Cancel a confirmed booking${NC}
    nycli cancel-booking --booking-id "abc-123" --reason-code "OTHER" --reason-stage OnConfirm

    ${DIM}# Get booking details${NC}
    nycli booking-details --booking-id "abc-123"

    ${DIM}# Get live ride status${NC}
    nycli ride-status --ride-id "abc-123"

    ${DIM}# Add post-ride tip${NC}
    nycli post-tip --ride-id "abc-123" --amount 50

    ${DIM}# Get fare breakdown${NC}
    nycli price-breakdown --booking-id "abc-123"

${BOLD}ENVIRONMENT${NC}
    NY_API_BASE    Override API base URL (default: https://api.moving.tech/pilot/app/v2)

${BOLD}TOKEN${NC}
    Stored at: ~/.namma-yatri/token.json
    Install jq for best experience: https://jqlang.github.io/jq/

HELPEOF
}

# =============================================================================
# Main
# =============================================================================

main() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        auth)                  cmd_auth "$@" ;;
        places)                cmd_places "$@" ;;
        place-details)         cmd_place_details "$@" ;;
        search)                cmd_search "$@" ;;
        select)                cmd_select "$@" ;;
        tip)                   cmd_tip "$@" ;;
        cancel)                cmd_cancel "$@" ;;
        status)                cmd_status "$@" ;;
        saved-locations)       cmd_saved_locations "$@" ;;
        cancellation-reasons)  cmd_cancellation_reasons "$@" ;;
        cancel-booking)        cmd_cancel_booking "$@" ;;
        booking-details)       cmd_booking_details "$@" ;;
        ride-status)           cmd_ride_status "$@" ;;
        post-tip)              cmd_post_tip "$@" ;;
        price-breakdown)       cmd_price_breakdown "$@" ;;
        help|--help|-h)        cmd_help ;;
        version|--version|-v)  echo "nycli $VERSION" ;;
        *)
            err "Unknown command: $cmd"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
