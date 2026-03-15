#!/bin/sh
set -e

# =============================================================================
# ny-cli installer
# Installs the interactive TUI (Node.js) or falls back to legacy bash script
# Usage: curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh
# =============================================================================

REPO="nammayatri/ny-connectors"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
LEGACY_SCRIPT_URL="${RAW_BASE}/cli/ny-cli.sh"
LEGACY_NAME="ny-cli-legacy"
TUI_NAME="ny-cli-tui"
BINARY_NAME="ny-cli"
TUI_DIR="$HOME/.namma-yatri/ny-cli-tui"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { printf "${BLUE}[info]${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}  ✓  ${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${NC} %s\n" "$*" >&2; }
err()   { printf "${RED}[error]${NC} %s\n" "$*" >&2; }

# =============================================================================
# Helper Functions
# =============================================================================

detect_nodejs() {
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//')
        NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
        if [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

detect_npm() {
    command -v npm >/dev/null 2>&1
}

get_install_dir() {
    if [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
        echo "$HOME/.local/bin"
    elif [ -w "/usr/local/bin" ]; then
        echo "/usr/local/bin"
    else
        echo ""
    fi
}

is_in_path() {
    local dir="$1"
    case ":$PATH:" in
        *":${dir}:"*) return 0 ;;
        *) return 1 ;;
    esac
}

print_path_warning() {
    local dir="$1"
    if ! is_in_path "$dir"; then
        echo ""
        warn "${dir} is not in your PATH."
        echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo ""
        echo "  export PATH=\"${dir}:\$PATH\""
        echo ""
        echo "Then restart your shell or run: source ~/.bashrc"
    fi
}

# =============================================================================
# Installation Methods
# =============================================================================

install_tui() {
    local install_dir="$1"
    
    info "Installing ${BOLD}ny-cli-tui${NC} (Node.js TUI)..."
    
    # Create TUI directory
    mkdir -p "$TUI_DIR"
    
    # Download the TUI source files
    info "Downloading TUI source..."
    
    local temp_dir
    temp_dir=$(mktemp -d)
    local cleanup_temp=true
    
    # Download archive
    local archive_url="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
    
    if command -v curl >/dev/null 2>&1; then
        if curl -sSL "$archive_url" | tar -xz -C "$temp_dir" --strip-components=1 2>/dev/null; then
            ok "Downloaded source archive"
        else
            err "Failed to download/extract source archive"
            rm -rf "$temp_dir"
            return 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        if wget -qO- "$archive_url" | tar -xz -C "$temp_dir" --strip-components=1 2>/dev/null; then
            ok "Downloaded source archive"
        else
            err "Failed to download/extract source archive"
            rm -rf "$temp_dir"
            return 1
        fi
    else
        err "Neither curl nor wget available"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Check if ny-cli-tui directory exists in the downloaded source
    if [ ! -d "$temp_dir/ny-cli-tui" ]; then
        err "TUI source not found in repository"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Copy TUI source to installation directory
    rm -rf "$TUI_DIR"/*
    cp -r "$temp_dir/ny-cli-tui"/* "$TUI_DIR/"
    rm -rf "$temp_dir"
    
    # Build the TUI
    info "Installing dependencies..."
    cd "$TUI_DIR"
    
    if ! npm install 2>/dev/null; then
        err "Failed to install npm dependencies"
        return 1
    fi
    ok "Dependencies installed"
    
    info "Building TUI..."
    if ! npm run build 2>/dev/null; then
        err "Failed to build TUI"
        return 1
    fi
    ok "TUI built successfully"
    
    # Create wrapper script for ny-cli-tui
    cat > "${install_dir}/${TUI_NAME}" << 'TUI_SCRIPT'
#!/bin/sh
# ny-cli-tui wrapper script
TUI_DIR="$HOME/.namma-yatri/ny-cli-tui"
exec node "$TUI_DIR/dist/index.js" "$@"
TUI_SCRIPT
    chmod +x "${install_dir}/${TUI_NAME}"
    
    # Create main ny-cli wrapper that prefers TUI but falls back to legacy
    cat > "${install_dir}/${BINARY_NAME}" << 'WRAPPER_SCRIPT'
#!/bin/sh
# ny-cli wrapper - launches the TUI or falls back to legacy

TUI_PATH=""
LEGACY_PATH=""

# Find TUI
if [ -x "$HOME/.local/bin/ny-cli-tui" ]; then
    TUI_PATH="$HOME/.local/bin/ny-cli-tui"
elif [ -x "/usr/local/bin/ny-cli-tui" ]; then
    TUI_PATH="/usr/local/bin/ny-cli-tui"
fi

# Find legacy
if [ -x "$HOME/.local/bin/ny-cli-legacy" ]; then
    LEGACY_PATH="$HOME/.local/bin/ny-cli-legacy"
elif [ -x "/usr/local/bin/ny-cli-legacy" ]; then
    LEGACY_PATH="/usr/local/bin/ny-cli-legacy"
fi

# Check for --legacy flag
if [ "$1" = "--legacy" ] || [ "$1" = "-l" ]; then
    shift
    if [ -n "$LEGACY_PATH" ]; then
        exec "$LEGACY_PATH" "$@"
    else
        echo "Error: ny-cli-legacy not found" >&2
        exit 1
    fi
fi

# Launch TUI if available
if [ -n "$TUI_PATH" ]; then
    exec "$TUI_PATH" "$@"
else
    # Fall back to legacy
    if [ -n "$LEGACY_PATH" ]; then
        exec "$LEGACY_PATH" "$@"
    else
        echo "Error: ny-cli not properly installed" >&2
        exit 1
    fi
fi
WRAPPER_SCRIPT
    chmod +x "${install_dir}/${BINARY_NAME}"
    
    ok "TUI installed to ${TUI_DIR}"
    ok "Command installed: ${install_dir}/${BINARY_NAME}"
    return 0
}

install_legacy() {
    local install_dir="$1"
    
    info "Installing ${BOLD}ny-cli-legacy${NC} (bash script)..."
    
    local temp_file
    temp_file=$(mktemp)
    
    if ! curl -sSL "$LEGACY_SCRIPT_URL" -o "$temp_file"; then
        err "Failed to download legacy script"
        rm -f "$temp_file"
        return 1
    fi
    
    # Validate
    if ! head -1 "$temp_file" | grep -q '^#!'; then
        err "Downloaded file is not a valid script"
        rm -f "$temp_file"
        return 1
    fi
    
    # Install as ny-cli-legacy
    mv "$temp_file" "${install_dir}/${LEGACY_NAME}"
    chmod +x "${install_dir}/${LEGACY_NAME}"
    
    ok "Legacy script installed to ${install_dir}/${LEGACY_NAME}"
    
    # If no TUI installed yet, also create ny-cli symlink to legacy
    if [ ! -e "${install_dir}/${BINARY_NAME}" ]; then
        ln -sf "${install_dir}/${LEGACY_NAME}" "${install_dir}/${BINARY_NAME}"
        ok "ny-cli -> ny-cli-legacy (TUI not available)"
    fi
    
    return 0
}

# =============================================================================
# Main Installation
# =============================================================================

main() {
    echo ""
    echo "${BOLD}========================================${NC}"
    echo "${BOLD}  ny-cli Installer${NC}"
    echo "${BOLD}========================================${NC}"
    echo ""
    
    # Determine install directory
    INSTALL_DIR=$(get_install_dir)
    if [ -z "$INSTALL_DIR" ]; then
        err "Cannot find a writable install directory."
        err "Create ~/.local/bin or run with sudo."
        exit 1
    fi
    
    info "Install directory: ${INSTALL_DIR}"
    
    # Detect Node.js
    local has_node=false
    local has_npm=false
    
    if detect_nodejs; then
        has_node=true
        ok "Node.js v${NODE_VERSION} detected"
        
        if detect_npm; then
            has_npm=true
            ok "npm detected"
        else
            warn "Node.js found but npm is missing"
        fi
    else
        warn "Node.js 18+ not found"
        info "The TUI requires Node.js 18 or higher"
        info "Install from: https://nodejs.org/"
    fi
    
    echo ""
    
    # Install based on what's available
    local tui_installed=false
    local legacy_installed=false
    
    if [ "$has_node" = true ] && [ "$has_npm" = true ]; then
        # Try to install TUI
        if install_tui "$INSTALL_DIR"; then
            tui_installed=true
        else
            warn "TUI installation failed, falling back to legacy"
        fi
    fi
    
    # Always install legacy as fallback
    if install_legacy "$INSTALL_DIR"; then
        legacy_installed=true
    fi
    
    # Verify installation
    echo ""
    echo "${BOLD}========================================${NC}"
    if [ "$tui_installed" = true ]; then
        ok "${BOLD}Installation complete!${NC}"
        echo ""
        echo "  ${CYAN}ny-cli${NC}          - Launch interactive TUI"
        echo "  ${CYAN}ny-cli --legacy${NC} - Use legacy bash script"
        echo "  ${CYAN}ny-cli-legacy${NC}   - Direct access to legacy script"
        echo ""
        info "Run '${BOLD}ny-cli${NC}' to get started"
    elif [ "$legacy_installed" = true ]; then
        ok "${BOLD}Legacy installation complete!${NC}"
        echo ""
        warn "Node.js 18+ required for interactive TUI"
        info "Install Node.js from https://nodejs.org/"
        info "Then re-run this installer to get the TUI"
        echo ""
        info "Run '${BOLD}ny-cli help${NC}' to get started (legacy mode)"
    else
        err "Installation failed!"
        exit 1
    fi
    echo "${BOLD}========================================${NC}"
    
    # PATH warning
    print_path_warning "$INSTALL_DIR"
}

main "$@"