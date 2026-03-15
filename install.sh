#!/bin/sh
set -e

# =============================================================================
# ny-cli installer
# Usage: curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh
# =============================================================================

REPO="nammayatri/ny-connectors"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
LEGACY_SCRIPT_URL="${RAW_BASE}/cli/ny-cli.sh"
BINARY_NAME="ny-cli"
LEGACY_NAME="ny-cli-legacy"
MIN_NODE_MAJOR=20

# Colors
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
# Check Node.js version
# =============================================================================

check_node() {
    if ! command -v node >/dev/null 2>&1; then
        err "Node.js is not installed."
        echo ""
        echo "Please install Node.js ${MIN_NODE_MAJOR} or later:"
        echo "  • Using nvm: nvm install --lts"
        echo "  • Using Homebrew: brew install node"
        echo "  • Official: https://nodejs.org/"
        exit 1
    fi

    node_version=$(node -v 2>/dev/null | sed 's/^v//')
    node_major=$(echo "$node_version" | cut -d. -f1)

    if [ -z "$node_major" ] || [ "$node_major" -lt "$MIN_NODE_MAJOR" ]; then
        err "Node.js ${MIN_NODE_MAJOR}+ is required (found v${node_version})."
        echo ""
        echo "Please upgrade Node.js:"
        echo "  • Using nvm: nvm install --lts && nvm use --lts"
        echo "  • Using Homebrew: brew upgrade node"
        exit 1
    fi

    ok "Node.js v${node_version} detected"
}

# =============================================================================
# Determine install directory
# =============================================================================

get_install_dir() {
    INSTALL_DIR=""
    
    # Prefer ~/.local/bin if it exists or can be created
    if [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
        INSTALL_DIR="$HOME/.local/bin"
    # Fall back to /usr/local/bin if writable
    elif [ -w "/usr/local/bin" ]; then
        INSTALL_DIR="/usr/local/bin"
    # Try npm global prefix
    else
        npm_prefix=$(npm config get prefix 2>/dev/null || echo "")
        if [ -n "$npm_prefix" ] && [ -d "$npm_prefix/bin" ]; then
            INSTALL_DIR="$npm_prefix/bin"
        fi
    fi

    if [ -z "$INSTALL_DIR" ]; then
        err "Cannot find a writable install directory."
        echo "Create ~/.local/bin or run with sudo."
        exit 1
    fi

    ok "Install directory: ${INSTALL_DIR}"
}

# =============================================================================
# Check for existing installation
# =============================================================================

check_existing() {
    LEGACY_EXISTS=false
    TUI_EXISTS=false
    IS_UPGRADE=false

    if [ -f "${INSTALL_DIR}/${LEGACY_NAME}" ]; then
        LEGACY_EXISTS=true
    fi

    if [ -f "${INSTALL_DIR}/${BINARY_NAME}" ]; then
        # Check if it's the old bash script
        if head -1 "${INSTALL_DIR}/${BINARY_NAME}" 2>/dev/null | grep -q 'bash'; then
            IS_UPGRADE=true
            ok "Found existing bash CLI (will be renamed to ${LEGACY_NAME})"
        elif command -v npm >/dev/null 2>&1; then
            # Check if it's a npm symlink to the TUI
            if npm list -g ny-cli-tui >/dev/null 2>&1; then
                TUI_EXISTS=true
                ok "TUI already installed via npm"
            fi
        fi
    fi
}

# =============================================================================
# Install legacy bash CLI (fallback)
# =============================================================================

install_legacy() {
    info "Installing ${LEGACY_NAME} (bash fallback)..."

    TEMP_FILE=$(mktemp)
    if ! curl -sSL "$LEGACY_SCRIPT_URL" -o "$TEMP_FILE"; then
        err "Failed to download ${LEGACY_NAME}."
        rm -f "$TEMP_FILE"
        exit 1
    fi

    # Validate it's a shell script
    if ! head -1 "$TEMP_FILE" | grep -q '^#!'; then
        err "Downloaded file is not a valid script."
        rm -f "$TEMP_FILE"
        exit 1
    fi

    mv "$TEMP_FILE" "${INSTALL_DIR}/${LEGACY_NAME}"
    chmod +x "${INSTALL_DIR}/${LEGACY_NAME}"

    ok "${LEGACY_NAME} installed to ${INSTALL_DIR}/${LEGACY_NAME}"
}

# =============================================================================
# Rename old CLI to legacy
# =============================================================================

rename_to_legacy() {
    if [ -f "${INSTALL_DIR}/${BINARY_NAME}" ]; then
        # Backup existing legacy if present
        if [ -f "${INSTALL_DIR}/${LEGACY_NAME}" ]; then
            rm -f "${INSTALL_DIR}/${LEGACY_NAME}"
        fi
        
        mv "${INSTALL_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${LEGACY_NAME}"
        ok "Renamed old CLI to ${LEGACY_NAME}"
    fi
}

# =============================================================================
# Install TUI via npm
# =============================================================================

install_tui() {
    info "Installing ny-cli-tui via npm..."

    # Check if npm is available
    if ! command -v npm >/dev/null 2>&1; then
        err "npm is not installed. Please install Node.js with npm."
        exit 1
    fi

    # Install globally
    # In a real scenario, this would install from npm registry
    # For development, we install from the local package
    if [ -d "ny-cli-tui" ] && [ -f "ny-cli-tui/package.json" ]; then
        # Local development install
        cd ny-cli-tui && npm install && npm link
        cd ..
        ok "Installed from local source"
    else
        # Production install from npm (when published)
        npm install -g ny-cli-tui 2>/dev/null || {
            warn "Could not install from npm registry."
            info "Attempting to install from GitHub..."
            
            # Clone and install from GitHub
            TEMP_DIR=$(mktemp -d)
            git clone --depth 1 "https://github.com/${REPO}.git" "$TEMP_DIR" 2>/dev/null || {
                err "Failed to clone repository."
                rm -rf "$TEMP_DIR"
                exit 1
            }
            
            cd "$TEMP_DIR/ny-cli-tui"
            npm install
            npm link
            cd -
            rm -rf "$TEMP_DIR"
        }
        ok "Installed ny-cli-tui globally"
    fi

    # Verify installation
    if ! command -v ny-cli >/dev/null 2>&1; then
        warn "ny-cli not in PATH after npm install"
        info "Creating symlink manually..."
        
        npm_bin=$(npm bin -g 2>/dev/null || echo "")
        if [ -n "$npm_bin" ] && [ -f "${npm_bin}/ny-cli" ]; then
            ln -sf "${npm_bin}/ny-cli" "${INSTALL_DIR}/${BINARY_NAME}"
            ok "Symlink created: ${INSTALL_DIR}/${BINARY_NAME} -> ${npm_bin}/ny-cli"
        else
            err "Could not find ny-cli binary after installation."
            exit 1
        fi
    fi
}

# =============================================================================
# Create ny-cli symlink (ensure it points to TUI)
# =============================================================================

ensure_symlink() {
    # Find where npm installed the binary
    npm_bin=$(npm bin -g 2>/dev/null || echo "")
    
    if [ -n "$npm_bin" ] && [ -f "${npm_bin}/ny-cli" ]; then
        # Remove existing file/symlink
        rm -f "${INSTALL_DIR}/${BINARY_NAME}"
        
        # Create symlink to npm global bin
        ln -sf "${npm_bin}/ny-cli" "${INSTALL_DIR}/${BINARY_NAME}"
        ok "Symlink: ${INSTALL_DIR}/${BINARY_NAME} -> ${npm_bin}/ny-cli"
    fi
}

# =============================================================================
# Check PATH
# =============================================================================

check_path() {
    case ":$PATH:" in
        *":${INSTALL_DIR}:"*)
            true
            ;;
        *)
            echo ""
            warn "${INSTALL_DIR} is not in your PATH."
            echo ""
            echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
            echo ""
            echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
            echo ""
            echo "Then restart your shell or run: source ~/.bashrc"
            ;;
    esac
}

# =============================================================================
# Print success message
# =============================================================================

print_success() {
    echo ""
    header "Installation complete!"
    echo ""
    echo "  ${CYAN}ny-cli${NC}         Interactive TUI for ride booking"
    echo "  ${CYAN}ny-cli-legacy${NC}  Bash fallback (original CLI)"
    echo ""
    echo "Quick start:"
    echo ""
    echo "  ${DIM}# Start interactive booking${NC}"
    echo "  ny-cli"
    echo ""
    echo "  ${DIM}# Authenticate${NC}"
    echo "  ny-cli auth"
    echo ""
    echo "  ${DIM}# Use legacy CLI${NC}"
    echo "  ny-cli-legacy help"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    header "ny-cli installer"
    echo ""

    # Step 1: Check Node.js
    check_node
    echo ""

    # Step 2: Determine install directory
    get_install_dir
    echo ""

    # Step 3: Check for existing installation
    check_existing
    echo ""

    # Step 4: Handle upgrade or fresh install
    if [ "$IS_UPGRADE" = "true" ]; then
        info "Upgrading existing installation..."
        rename_to_legacy
    elif [ "$TUI_EXISTS" = "true" ]; then
        info "Reinstalling TUI..."
    else
        info "Fresh installation..."
    fi

    # Step 5: Install legacy CLI (always available as fallback)
    if [ "$LEGACY_EXISTS" = "false" ]; then
        install_legacy
    else
        ok "${LEGACY_NAME} already exists"
    fi
    echo ""

    # Step 6: Install TUI
    if [ "$TUI_EXISTS" = "false" ]; then
        install_tui
    else
        ok "TUI already installed"
    fi
    echo ""

    # Step 7: Ensure symlink is correct
    ensure_symlink

    # Step 8: Check PATH
    check_path

    # Step 9: Print success
    print_success
}

main "$@"