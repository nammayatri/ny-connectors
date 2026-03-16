#!/usr/bin/env bash
# =============================================================================
# Test suite for ny-cli → nycli rename
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

pass() {
    printf "${GREEN}✓ PASS:${NC} %s\n" "$*"
    ((TESTS_PASSED++)) || true
}

fail() {
    printf "${RED}✗ FAIL:${NC} %s\n" "$*"
    ((TESTS_FAILED++)) || true
}

section() {
    printf "\n${YELLOW}=== %s ===${NC}\n" "$*"
}

# =============================================================================
# Test 1: No remaining "ny-cli" references in source files
# =============================================================================
section "Test 1: No 'ny-cli' references in source files"

# Check all non-git files for "ny-cli"
FOUND_NY_CLI=""
if grep -r "ny-cli" --include="*.sh" --include="*.md" --include="*.ts" --include="*.json" . 2>/dev/null | grep -v ".git" | grep -v "node_modules" | grep -v "tests/test_rename.sh" > /tmp/ny-cli-found.txt; then
    FOUND_NY_CLI=$(cat /tmp/ny-cli-found.txt)
fi

if [ -n "$FOUND_NY_CLI" ]; then
    fail "Found 'ny-cli' references in source files"
    echo "$FOUND_NY_CLI"
else
    pass "No 'ny-cli' references found in source files"
fi

# =============================================================================
# Test 2: CLI script file is named nycli.sh
# =============================================================================
section "Test 2: CLI script file naming"

if [ -f "cli/nycli.sh" ]; then
    pass "CLI script file exists at cli/nycli.sh"
else
    fail "CLI script file NOT found at cli/nycli.sh"
fi

if [ -f "cli/ny-cli.sh" ]; then
    fail "Old CLI script file still exists at cli/ny-cli.sh"
else
    pass "Old CLI script file (ny-cli.sh) has been removed"
fi

# =============================================================================
# Test 3: Install script references nycli
# =============================================================================
section "Test 3: Install script references"

# Check install.sh uses nycli
if grep -q 'BINARY_NAME="nycli"' install.sh; then
    pass "install.sh sets BINARY_NAME to 'nycli'"
else
    fail "install.sh does not set BINARY_NAME to 'nycli'"
fi

if grep -q 'cli/nycli.sh' install.sh; then
    pass "install.sh references cli/nycli.sh"
else
    fail "install.sh does not reference cli/nycli.sh"
fi

if grep -q "Run 'nycli help'" install.sh; then
    pass "install.sh shows 'nycli help' message"
else
    fail "install.sh does not show 'nycli help' message"
fi

# =============================================================================
# Test 4: CLI script internal references
# =============================================================================
section "Test 4: CLI script internal references"

# Check header comment
if grep -q "# nycli — Namma Yatri CLI" cli/nycli.sh; then
    pass "CLI script header mentions 'nycli'"
else
    fail "CLI script header does not mention 'nycli'"
fi

# Check version command
if grep -q 'echo "nycli \$VERSION"' cli/nycli.sh; then
    pass "Version command outputs 'nycli'"
else
    fail "Version command does not output 'nycli'"
fi

# Check help header
if grep -q 'nycli.*v.*Namma Yatri CLI' cli/nycli.sh; then
    pass "Help header shows 'nycli'"
else
    fail "Help header does not show 'nycli'"
fi

# Check usage line
if grep -q 'nycli <command>' cli/nycli.sh; then
    pass "Usage line shows 'nycli'"
else
    fail "Usage line does not show 'nycli'"
fi

# Check example commands use nycli
if grep -q 'nycli auth --mobile' cli/nycli.sh; then
    pass "Example commands use 'nycli'"
else
    fail "Example commands do not use 'nycli'"
fi

# Check error messages use nycli
if grep -q "nycli auth" cli/nycli.sh; then
    pass "Error messages reference 'nycli auth'"
else
    fail "Error messages do not reference 'nycli auth'"
fi

# =============================================================================
# Test 5: README.md references
# =============================================================================
section "Test 5: README.md references"

# Check README uses nycli in examples
if grep -q 'nycli auth --mobile' README.md; then
    pass "README shows 'nycli auth' example"
else
    fail "README does not show 'nycli auth' example"
fi

# Check README mentions nycli.sh
if grep -q 'nycli.sh' README.md; then
    pass "README mentions nycli.sh"
else
    fail "README does not mention nycli.sh"
fi

# Check README command table
if grep -q '| `nycli auth`' README.md; then
    pass "README command table uses 'nycli'"
else
    fail "README command table does not use 'nycli'"
fi

# Check README installation section
if grep -q 'Installs `nycli`' README.md; then
    pass "README installation section mentions 'nycli'"
else
    fail "README installation section does not mention 'nycli'"
fi

# =============================================================================
# Test 6: CLAUDE.md references
# =============================================================================
section "Test 6: CLAUDE.md references"

if grep -q 'nycli' CLAUDE.md; then
    pass "CLAUDE.md mentions 'nycli'"
else
    fail "CLAUDE.md does not mention 'nycli'"
fi

if grep -q 'nycli.sh' CLAUDE.md; then
    pass "CLAUDE.md mentions nycli.sh"
else
    fail "CLAUDE.md does not mention nycli.sh"
fi

# =============================================================================
# Test 7: CLI script is valid bash
# =============================================================================
section "Test 7: CLI script syntax validation"

if bash -n cli/nycli.sh 2>/dev/null; then
    pass "CLI script has valid bash syntax"
else
    fail "CLI script has bash syntax errors"
fi

# =============================================================================
# Test 8: CLI script help command works
# =============================================================================
section "Test 8: CLI script help command"

HELP_OUTPUT=$(bash cli/nycli.sh help 2>&1) || HELP_OUTPUT=""

if echo "$HELP_OUTPUT" | grep -q "nycli"; then
    pass "Help output contains 'nycli'"
else
    fail "Help output does not contain 'nycli'"
fi

if echo "$HELP_OUTPUT" | grep -q "Namma Yatri CLI"; then
    pass "Help output contains 'Namma Yatri CLI'"
else
    fail "Help output does not contain 'Namma Yatri CLI'"
fi

# =============================================================================
# Test 9: CLI script version command works
# =============================================================================
section "Test 9: CLI script version command"

VERSION_OUTPUT=$(bash cli/nycli.sh version 2>&1) || VERSION_OUTPUT=""

if echo "$VERSION_OUTPUT" | grep -q "^nycli"; then
    pass "Version output starts with 'nycli'"
else
    fail "Version output does not start with 'nycli' (got: $VERSION_OUTPUT)"
fi

# =============================================================================
# Test 10: Install script syntax validation
# =============================================================================
section "Test 10: Install script syntax validation"

if bash -n install.sh 2>/dev/null; then
    pass "Install script has valid bash syntax"
else
    fail "Install script has bash syntax errors"
fi

# =============================================================================
# Summary
# =============================================================================
printf "\n${YELLOW}========================================${NC}\n"
printf "${YELLOW}Test Summary${NC}\n"
printf "${YELLOW}========================================${NC}\n"
printf "Passed: ${GREEN}%d${NC}\n" "$TESTS_PASSED"
printf "Failed: ${RED}%d${NC}\n" "$TESTS_FAILED"
printf "${YELLOW}========================================${NC}\n"

if [ "$TESTS_FAILED" -eq 0 ]; then
    printf "${GREEN}All tests passed!${NC}\n"
    exit 0
else
    printf "${RED}Some tests failed!${NC}\n"
    exit 1
fi