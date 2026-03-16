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

echo "Installing ${BINARY_NAME}..."

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

# Download
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

echo ""
echo "${BINARY_NAME} installed to ${INSTALL_DIR}/${BINARY_NAME}"

# Check PATH
case ":$PATH:" in
    *":${INSTALL_DIR}:"*)
        echo "Run 'nycli help' to get started."
        ;;
    *)
        echo ""
        echo "NOTE: ${INSTALL_DIR} is not in your PATH."
        echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo ""
        echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
        echo ""
        echo "Then restart your shell or run: source ~/.bashrc"
        ;;
esac
