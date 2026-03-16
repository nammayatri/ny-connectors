#!/bin/sh
set -e

# =============================================================================
# nycli installer
# Usage: curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh
# =============================================================================

REPO="nammayatri/ny-connectors"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
SCRIPT_URL="${RAW_BASE}/cli/nycli.sh"
BINARY_NAME="nycli"

# Colors for output (if terminal supports it)
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' NC=''
fi

info()  { printf "${BLUE}[info]${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}  ok  ${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${NC} %s\n" "$*" >&2; }

# =============================================================================
# Check if Node.js is available and meets version requirements
# =============================================================================

check_nodejs() {
    if ! command -v node >/dev/null 2>&1; then
        return 1
    fi
    
    # Check Node.js version (need 18+)
    NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    
    if [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
        return 0
    else
        warn "Node.js $NODE_VERSION found, but version 18+ is required for TUI"
        return 1
    fi
}

# =============================================================================
# Install TypeScript TUI CLI
# =============================================================================

install_tui_cli() {
    INSTALL_DIR="$1"
    TEMP_DIR=$(mktemp -d)
    
    info "Installing interactive TUI CLI (Node.js $NODE_VERSION detected)..."
    
    # Download the cli directory contents
    CLI_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
    
    if ! curl -sSL "$CLI_URL" -o "${TEMP_DIR}/repo.tar.gz"; then
        warn "Failed to download repository archive"
        rm -rf "$TEMP_DIR"
        return 1
    fi
    
    # Extract only the cli directory
    if ! tar -xzf "${TEMP_DIR}/repo.tar.gz" -C "$TEMP_DIR" --strip-components=2 "ny-connectors-${BRANCH}/cli/" 2>/dev/null; then
        warn "Failed to extract CLI files"
        rm -rf "$TEMP_DIR"
        return 1
    fi
    
    CLI_DIR="${TEMP_DIR}/cli"
    
    if [ ! -f "${CLI_DIR}/package.json" ]; then
        warn "CLI package.json not found in extracted files"
        rm -rf "$TEMP_DIR"
        return 1
    fi
    
    # Install dependencies and build
    info "Installing dependencies..."
    if ! (cd "$CLI_DIR" && npm install --silent 2>/dev/null); then
        warn "Failed to install npm dependencies"
        rm -rf "$TEMP_DIR"
        return 1
    fi
    
    info "Building TypeScript..."
    if ! (cd "$CLI_DIR" && npm run build --silent 2>/dev/null); then
        warn "Failed to build TypeScript"
        rm -rf "$TEMP_DIR"
        return 1
    fi
    
    # Install the built CLI
    # Create a wrapper script that runs the Node.js CLI
    cat > "${INSTALL_DIR}/${BINARY_NAME}" << 'WRAPPER_EOF'
#!/usr/bin/env sh
# Namma Yatri CLI - Interactive TUI wrapper
# This script runs the Node.js TUI if available, otherwise falls back to bash

NYCLI_DIR="${HOME}/.local/share/nycli"
NODE_CLI="${NYCLI_DIR}/dist/index.js"
BASH_CLI="${NYCLI_DIR}/nycli.sh"

# Check if we should use bash version (NYCLI_BASH=1)
if [ "${NYCLI_BASH}" = "1" ] && [ -f "$BASH_CLI" ]; then
    exec "$BASH_CLI" "$@"
fi

# Check if Node.js TUI is available
if [ -f "$NODE_CLI" ] && command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
        exec node "$NODE_CLI" "$@"
    fi
fi

# Fallback to bash version
if [ -f "$BASH_CLI" ]; then
    exec "$BASH_CLI" "$@"
else
    echo "Error: Neither Node.js TUI nor Bash CLI found at ${NYCLI_DIR}"
    echo "Please reinstall: curl -sSL ... | sh"
    exit 1
fi
WRAPPER_EOF
    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    
    # Install the actual CLI files to ~/.local/share/nycli
    SHARE_DIR="${HOME}/.local/share/nycli"
    mkdir -p "$SHARE_DIR"
    
    # Copy built files
    cp -r "${CLI_DIR}/dist" "$SHARE_DIR/"
    cp "${CLI_DIR}/package.json" "$SHARE_DIR/"
    
    # Also download and save the bash fallback
    curl -sSL "$SCRIPT_URL" -o "${SHARE_DIR}/nycli.sh"
    chmod +x "${SHARE_DIR}/nycli.sh"
    
    # Install production dependencies for the TUI
    (cd "$SHARE_DIR" && npm install --production --silent 2>/dev/null || true)
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    return 0
}

# =============================================================================
# Install Bash CLI (fallback)
# =============================================================================

install_bash_cli() {
    INSTALL_DIR="$1"
    
    info "Installing Bash CLI (lightweight fallback)..."
    
    TEMP_FILE=$(mktemp)
    if ! curl -sSL "$SCRIPT_URL" -o "$TEMP_FILE"; then
        echo "Error: Failed to download ${BINARY_NAME}."
        rm -f "$TEMP_FILE"
        exit 1
    fi
    
    # Validate
    if ! head -1 "$TEMP_FILE" | grep -q '^#!'; then
        echo "Error: Downloaded file is not a valid script."
        rm -f "$TEMP_FILE"
        exit 1
    fi
    
    # Install
    mv "$TEMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"
    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
}

# =============================================================================
# Main Installation
# =============================================================================

echo "${BOLD}Installing ${BINARY_NAME}...${NC}"
echo ""

# Determine install directory
INSTALL_DIR=""
if [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
    INSTALL_DIR="$HOME/.local/bin"
elif [ -w "/usr/local/bin" ]; then
    INSTALL_DIR="/usr/local/bin"
else
    echo "Error: Cannot find a writable install directory."
    echo "Create ~/.local/bin or run with sudo."
    exit 1
fi

# Check for Node.js and install appropriate version
if check_nodejs; then
    if install_tui_cli "$INSTALL_DIR"; then
        echo ""
        ok "${BINARY_NAME} installed to ${INSTALL_DIR}/${BINARY_NAME}"
        echo ""
        echo "${GREEN}✓${NC} Installed: ${BOLD}Interactive TUI version${NC} (Node.js $NODE_VERSION)"
        echo "  ${CYAN}Features:${NC} Wizard-style booking flow with 5 screens"
        echo "           Auth → Location → Ride Type → Confirm → Track"
        echo ""
        echo "  ${DIM}To use the Bash version instead, run:${NC}"
        echo "    NYCLI_BASH=1 ${BINARY_NAME}"
    else
        echo ""
        warn "TUI installation failed, falling back to Bash CLI..."
        install_bash_cli "$INSTALL_DIR"
        echo ""
        ok "${BINARY_NAME} installed to ${INSTALL_DIR}/${BINARY_NAME}"
        echo ""
        echo "${YELLOW}⚠${NC} Installed: ${BOLD}Bash version${NC} (TUI build failed)"
        echo "  ${DIM}Install Node.js 18+ for the interactive TUI version${NC}"
    fi
else
    install_bash_cli "$INSTALL_DIR"
    echo ""
    ok "${BINARY_NAME} installed to ${INSTALL_DIR}/${BINARY_NAME}"
    echo ""
    echo "${YELLOW}⚠${NC} Installed: ${BOLD}Bash version${NC} (Node.js not available)"
    echo "  ${DIM}Install Node.js 18+ for the interactive TUI version:${NC}"
    echo "    https://nodejs.org/ or use your package manager"
    echo ""
    echo "  The Bash version provides full functionality via commands:"
    echo "    ${BINARY_NAME} auth       - Authenticate with phone + OTP"
    echo "    ${BINARY_NAME} search     - Search for rides"
    echo "    ${BINARY_NAME} select     - Select and book a ride"
    echo "    ${BINARY_NAME} status     - Check ride status"
fi

# Check PATH
echo ""
case ":$PATH:" in
    *":${INSTALL_DIR}:"*)
        echo "Run '${BINARY_NAME} help' to get started."
        ;;
    *)
        echo "${YELLOW}NOTE:${NC} ${INSTALL_DIR} is not in your PATH."
        echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo ""
        echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
        echo ""
        echo "Then restart your shell or run: source ~/.bashrc"
        ;;
esac
