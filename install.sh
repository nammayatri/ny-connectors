#!/bin/sh
set -e

# =============================================================================
# ny-cli installer
# Usage: curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh
# =============================================================================

REPO="nammayatri/ny-connectors"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
SCRIPT_URL="${RAW_BASE}/cli/ny-cli.sh"

# Colors
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    NC='\033[0m'
else
    GREEN='' BLUE='' YELLOW='' RED='' NC=''
fi

info()  { printf "${BLUE}[info]${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}  ok  ${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${NC} %s\n" "$*" >&2; }
error() { printf "${RED}[error]${NC} %s\n" "$*" >&2; }

# =============================================================================
# Helper Functions
# =============================================================================

# Create wrapper script for ny-tui
# Usage: create_wrapper_script <install_dir>
create_wrapper_script() {
    local install_dir="$1"
    local wrapper_path="${install_dir}/ny-tui"
    
    # Validate install_dir to prevent path traversal
    case "$install_dir" in
        *..*)
            error "Invalid install directory: $install_dir"
            return 1
            ;;
    esac
    
    cat > "$wrapper_path" << 'WRAPPER_EOF'
#!/bin/sh
# Wrapper script for ny-tui
command -v node >/dev/null 2>&1 || { echo "Error: node not found. Please install Node.js 18+." >&2; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "${SCRIPT_DIR}/ny-tui-dist/index.js" "$@"
WRAPPER_EOF
    chmod +x "$wrapper_path"
}

# Cleanup function for temporary directories
cleanup_build_dir() {
    if [ -n "$BUILD_DIR" ] && [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
    fi
}

# Return to original directory
cleanup_and_return() {
    if [ -n "$ORIG_DIR" ] && [ -d "$ORIG_DIR" ]; then
        cd "$ORIG_DIR" 2>/dev/null || true
    fi
    cleanup_build_dir
}

echo ""
echo "Installing Namma Yatri CLI tools..."
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

info "Install directory: ${INSTALL_DIR}"

# =============================================================================
# Install ny-cli (Bash fallback script)
# =============================================================================
info "Downloading ny-cli (bash fallback)..."

TEMP_FILE=$(mktemp)
if ! curl -sSL "$SCRIPT_URL" -o "$TEMP_FILE"; then
    echo "Error: Failed to download ny-cli script."
    rm -f "$TEMP_FILE"
    exit 1
fi

# Validate
if ! head -1 "$TEMP_FILE" | grep -q '^#!'; then
    echo "Error: Downloaded file is not a valid script."
    rm -f "$TEMP_FILE"
    exit 1
fi

# Install bash script as ny-cli
mv "$TEMP_FILE" "${INSTALL_DIR}/ny-cli"
chmod +x "${INSTALL_DIR}/ny-cli"
ok "ny-cli installed to ${INSTALL_DIR}/ny-cli"

# =============================================================================
# Install ny-tui (TypeScript TUI with Ink)
# =============================================================================
info "Setting up ny-tui (TypeScript TUI)..."

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
    warn "Node.js not found. ny-tui requires Node.js 18+."
    warn "Please install Node.js from https://nodejs.org/"
    warn "The bash-based 'ny-cli' is still available as a fallback."
else
    NODE_VERSION=$(node --version | sed 's/v//; s/\..*//')
    if [ "$NODE_VERSION" -lt 18 ]; then
        warn "Node.js version $NODE_VERSION found, but 18+ is required for ny-tui."
        warn "The bash-based 'ny-cli' is still available as a fallback."
    else
        ok "Node.js $(node --version) found"
        
        # Check for npm availability
        if ! command -v npm >/dev/null 2>&1; then
            warn "npm not found. ny-tui requires npm to build."
            warn "Please install Node.js from https://nodejs.org/"
            warn "The bash-based 'ny-cli' is still available as a fallback."
        else
            ok "npm $(npm --version) found"
            
            # Create a temporary directory for building
            BUILD_DIR=$(mktemp -d)
            ORIG_DIR=$(pwd)
            
            # Set up cleanup trap for early exits
            trap cleanup_and_return EXIT
            
            info "Downloading source to ${BUILD_DIR}..."
            
            # Download package files (these are critical)
            if ! curl -sSL "${RAW_BASE}/cli/package.json" -o "${BUILD_DIR}/package.json"; then
                error "Failed to download package.json - cannot build ny-tui"
                warn "The bash-based 'ny-cli' is still available as a fallback."
                exit 1
            fi
            
            if ! curl -sSL "${RAW_BASE}/cli/tsconfig.json" -o "${BUILD_DIR}/tsconfig.json"; then
                error "Failed to download tsconfig.json - cannot build ny-tui"
                warn "The bash-based 'ny-cli' is still available as a fallback."
                exit 1
            fi
            
            # Create src directory structure and download source files
            mkdir -p "${BUILD_DIR}/src"
            
            # Download main source files
            DOWNLOAD_ERRORS=0
            
            for file in index.tsx app.tsx; do
                if ! curl -sSL "${RAW_BASE}/cli/src/${file}" -o "${BUILD_DIR}/src/${file}"; then
                    warn "Failed to download src/${file}"
                    DOWNLOAD_ERRORS=$((DOWNLOAD_ERRORS + 1))
                fi
            done
            
            # Download subdirectories with all source files
            for dir in api components hooks storage types utils; do
                mkdir -p "${BUILD_DIR}/src/${dir}"
            done
            
            # Download api files (production files only, no tests)
            for file in index.ts client.ts; do
                if ! curl -sSL "${RAW_BASE}/cli/src/api/${file}" -o "${BUILD_DIR}/src/api/${file}"; then
                    warn "Failed to download api/${file}"
                    DOWNLOAD_ERRORS=$((DOWNLOAD_ERRORS + 1))
                fi
            done
            
            # Download component files
            for file in Auth.tsx AuthWizard.tsx Header.tsx HistoryView.tsx LocationWizard.tsx MainMenu.tsx StatusView.tsx; do
                if ! curl -sSL "${RAW_BASE}/cli/src/components/${file}" -o "${BUILD_DIR}/src/components/${file}"; then
                    warn "Failed to download components/${file}"
                    DOWNLOAD_ERRORS=$((DOWNLOAD_ERRORS + 1))
                fi
            done
            
            # Download hooks files (production files only, no tests)
            for file in index.ts useStateMachine.ts; do
                if ! curl -sSL "${RAW_BASE}/cli/src/hooks/${file}" -o "${BUILD_DIR}/src/hooks/${file}"; then
                    warn "Failed to download hooks/${file}"
                    DOWNLOAD_ERRORS=$((DOWNLOAD_ERRORS + 1))
                fi
            done
            
            # Download storage files
            for file in index.ts token.ts; do
                if ! curl -sSL "${RAW_BASE}/cli/src/storage/${file}" -o "${BUILD_DIR}/src/storage/${file}"; then
                    warn "Failed to download storage/${file}"
                    DOWNLOAD_ERRORS=$((DOWNLOAD_ERRORS + 1))
                fi
            done
            
            # Download types files
            for file in index.ts ink-modules.d.ts; do
                if ! curl -sSL "${RAW_BASE}/cli/src/types/${file}" -o "${BUILD_DIR}/src/types/${file}"; then
                    warn "Failed to download types/${file}"
                    DOWNLOAD_ERRORS=$((DOWNLOAD_ERRORS + 1))
                fi
            done
            
            # Download utils files
            for file in api.ts storage.ts; do
                if ! curl -sSL "${RAW_BASE}/cli/src/utils/${file}" -o "${BUILD_DIR}/src/utils/${file}"; then
                    warn "Failed to download utils/${file}"
                    DOWNLOAD_ERRORS=$((DOWNLOAD_ERRORS + 1))
                fi
            done
            
            # Check for critical files after downloads
            if [ ! -f "${BUILD_DIR}/src/index.tsx" ]; then
                error "Critical source files failed to download. Cannot build ny-tui."
                error "Download errors: $DOWNLOAD_ERRORS"
                warn "The bash-based 'ny-cli' is still available as a fallback."
                warn "To build manually: git clone the repo, cd cli, npm install, npm run build"
                exit 1
            fi
            
            if [ $DOWNLOAD_ERRORS -gt 0 ]; then
                warn "Some source files failed to download ($DOWNLOAD_ERRORS errors)."
                warn "Attempting to build with available files..."
            fi
            
            info "Installing dependencies (this may take a minute)..."
            if ! cd "$BUILD_DIR"; then
                error "Failed to change to build directory: $BUILD_DIR"
                exit 1
            fi
            
            # Run npm install and capture output to log file
            NPM_LOG="${BUILD_DIR}/npm-install.log"
            if npm install > "$NPM_LOG" 2>&1; then
                info "Building TypeScript..."
                BUILD_LOG="${BUILD_DIR}/npm-build.log"
                
                if npm run build > "$BUILD_LOG" 2>&1; then
                    # Verify build output exists
                    if [ ! -d "${BUILD_DIR}/dist" ] || [ -z "$(ls -A "${BUILD_DIR}/dist" 2>/dev/null)" ]; then
                        error "Build completed but no output files found in dist/"
                        warn "The bash-based 'ny-cli' is still available as a fallback."
                        warn "To build manually: git clone the repo, cd cli, npm install, npm run build"
                    else
                        # Clean up old files first to avoid stale files
                        rm -rf "${INSTALL_DIR}/ny-tui-dist"
                        mkdir -p "${INSTALL_DIR}/ny-tui-dist"
                        
                        # Copy built files to install directory with proper error handling
                        if ! cp -r "${BUILD_DIR}/dist"/* "${INSTALL_DIR}/ny-tui-dist/"; then
                            error "Failed to copy build files to install directory"
                            exit 1
                        fi
                        cp "${BUILD_DIR}/package.json" "${INSTALL_DIR}/ny-tui-dist/" 2>/dev/null || true
                        
                        # Create wrapper script using helper function
                        create_wrapper_script "$INSTALL_DIR"
                        ok "ny-tui installed to ${INSTALL_DIR}/ny-tui"
                        
                        # Clean up log files on successful installation
                        rm -f "$NPM_LOG" "$BUILD_LOG"
                    fi
                else
                    error "Build failed. See build log below:"
                    echo "---"
                    cat "$BUILD_LOG"
                    echo "---"
                    warn "The bash-based 'ny-cli' is still available as a fallback."
                    warn "To build manually: git clone the repo, cd cli, npm install, npm run build"
                fi
            else
                error "npm install failed. See log below:"
                echo "---"
                cat "$NPM_LOG"
                echo "---"
                warn "The bash-based 'ny-cli' is still available as a fallback."
                warn "To build manually: git clone the repo, cd cli, npm install, npm run build"
            fi
        fi
    fi
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "========================================"
ok "Installation complete!"
echo "========================================"
echo ""
echo "Installed commands:"
echo "  ${GREEN}ny-tui${NC}  - Interactive TUI (Node.js 18+ required)"
echo "  ${GREEN}ny-cli${NC}  - Bash-based CLI (fallback)"
echo ""

# Check PATH
case ":$PATH:" in
    *":${INSTALL_DIR}:"*)
        echo "Run 'ny-tui' to start the interactive TUI"
        echo "Run 'ny-cli help' for the bash-based CLI"
        ;;
    *)
        echo "NOTE: ${INSTALL_DIR} is not in your PATH."
        echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo ""
        echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
        echo ""
        echo "Then restart your shell or run: source ~/.bashrc"
        ;;
esac
