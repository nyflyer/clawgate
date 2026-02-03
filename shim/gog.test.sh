#!/bin/sh
# Unit tests for gog shim
# Uses mock curl to test escape sequence handling
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHIM="$SCRIPT_DIR/gog"
MOCK_DIR=""
ORIGINAL_PATH="$PATH"
TESTS_RUN=0
TESTS_PASSED=0

# Colors for output (only if terminal supports it)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  NC=''
fi

setup() {
  MOCK_DIR=$(mktemp -d)

  # Create mock curl that returns predefined responses
  cat > "$MOCK_DIR/curl" << 'MOCK_CURL'
#!/bin/sh
# Mock curl - reads response from MOCK_RESPONSE env var or file
if [ -n "$MOCK_RESPONSE" ]; then
  printf '%s' "$MOCK_RESPONSE"
elif [ -f "$MOCK_RESPONSE_FILE" ]; then
  cat "$MOCK_RESPONSE_FILE"
else
  echo '{"ok":false,"error":{"code":"MOCK_ERROR","message":"no mock response"}}'
fi
exit "${MOCK_EXIT_CODE:-0}"
MOCK_CURL
  chmod +x "$MOCK_DIR/curl"

  # Prepend mock dir to PATH
  export PATH="$MOCK_DIR:$ORIGINAL_PATH"
  export CLAWGATE_URL="http://mock:9876"
}

teardown() {
  if [ -n "$MOCK_DIR" ] && [ -d "$MOCK_DIR" ]; then
    rm -rf "$MOCK_DIR"
  fi
  export PATH="$ORIGINAL_PATH"
  unset MOCK_RESPONSE MOCK_RESPONSE_FILE MOCK_EXIT_CODE
}

# Test assertion helper
# shellcheck disable=SC2317
assert_equals() {
  expected="$1"
  actual="$2"
  msg="$3"

  [ "$expected" = "$actual" ] && return 0

  [ -n "$msg" ] && printf "  Assertion failed: %s\n" "$msg"
  printf "  Expected: %s\n" "$expected"
  printf "  Actual:   %s\n" "$actual"
  return 1
}

# shellcheck disable=SC2317
assert_contains() {
  haystack="$1"
  needle="$2"

  case "$haystack" in
    *"$needle"*) return 0 ;;
    *)
      printf "  Expected to contain: %s\n" "$needle"
      printf "  Actual: %s\n" "$haystack"
      return 1
      ;;
  esac
}

# shellcheck disable=SC2317
assert_line_count() {
  actual="$1"
  op="$2"
  expected="$3"
  msg="$4"

  case "$op" in
    -ge) [ "$actual" -ge "$expected" ] && return 0 ;;
    -eq) [ "$actual" -eq "$expected" ] && return 0 ;;
    -ne) [ "$actual" -ne "$expected" ] && return 0 ;;
    *) printf "  Unknown operator: %s\n" "$op"; return 1 ;;
  esac

  [ -n "$msg" ] && printf "  Assertion failed: %s\n" "$msg"
  printf "  Expected: %s %s\n" "$op" "$expected"
  printf "  Actual:   %s\n" "$actual"
  return 1
}

# shellcheck disable=SC2317
assert_exit_code_nonzero() {
  exit_code="$1"
  msg="${2:-exit code should be non-zero}"

  [ "$exit_code" -ne 0 ] && return 0

  printf "  Assertion failed: %s\n" "$msg"
  printf "  Expected: non-zero\n"
  printf "  Actual:   %s\n" "$exit_code"
  return 1
}

# Run a test function
run_test() {
  test_name="$1"
  TESTS_RUN=$((TESTS_RUN + 1))

  printf "  %s... " "$test_name"

  setup

  output_log=$(mktemp)
  if "$test_name" >"$output_log" 2>&1; then
    printf "%sPASS%s\n" "$GREEN" "$NC"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    printf "%sFAIL%s\n" "$RED" "$NC"
    sed 's/^/    /' "$output_log"
  fi
  rm "$output_log"

  teardown
}

# ============================================================================
# TEST CASES
# ============================================================================

# shellcheck disable=SC2317
test_newline_in_json_becomes_actual_newline() {
  # JSON \n escape should become actual newline in output
  # shellcheck disable=SC2089,SC2090
  export MOCK_RESPONSE='{"ok":true,"data":{"stdout":"hello\nworld","stderr":"","exitCode":0}}'

  output=$("$SHIM" test 2>&1)

  assert_contains "$output" "hello" || return 1
  assert_contains "$output" "world" || return 1

  # Verify actual newline exists (not literal \n)
  line_count=$(printf '%s' "$output" | wc -l)
  assert_line_count "$line_count" -ge 1 "output should contain newline"
}

# shellcheck disable=SC2317
test_literal_backslash_n_preserved() {
  # JSON \\n (escaped backslash + n) should become literal \n in output
  # shellcheck disable=SC2089,SC2090
  export MOCK_RESPONSE='{"ok":true,"data":{"stdout":"hello\\nworld","stderr":"","exitCode":0}}'

  output=$("$SHIM" test 2>&1)

  # Output should be on a single line (no actual newline)
  line_count=$(printf '%s' "$output" | wc -l)
  assert_line_count "$line_count" -eq 0 "output should have no newlines" || return 1

  # Should contain literal backslash-n
  assert_contains "$output" 'hello\nworld'
}

# shellcheck disable=SC2317
test_tab_characters_preserved() {
  # shellcheck disable=SC2089,SC2090
  export MOCK_RESPONSE='{"ok":true,"data":{"stdout":"col1\tcol2\tcol3","stderr":"","exitCode":0}}'

  output=$("$SHIM" test 2>&1)

  # Assert actual tab characters exist between columns (not spaces)
  assert_contains "$output" "$(printf 'col1\tcol2')" || return 1
  assert_contains "$output" "$(printf 'col2\tcol3')" || return 1
}

# shellcheck disable=SC2317
test_exit_code_propagates() {
  # shellcheck disable=SC2089,SC2090
  export MOCK_RESPONSE='{"ok":true,"data":{"stdout":"","stderr":"error output","exitCode":42}}'

  set +e
  "$SHIM" test >/dev/null 2>&1
  exit_code=$?
  set -e

  assert_equals "42" "$exit_code"
}

# shellcheck disable=SC2317
test_error_response_handled() {
  # shellcheck disable=SC2089,SC2090
  export MOCK_RESPONSE='{"ok":false,"error":{"code":"OPERATION_DENIED","message":"command not allowed"}}'

  set +e
  output=$("$SHIM" test 2>&1)
  exit_code=$?
  set -e

  assert_exit_code_nonzero "$exit_code" || return 1
  assert_contains "$output" "command not allowed"
}

# shellcheck disable=SC2317
test_stderr_goes_to_stderr() {
  # shellcheck disable=SC2089,SC2090
  export MOCK_RESPONSE='{"ok":true,"data":{"stdout":"stdout msg","stderr":"stderr msg","exitCode":0}}'

  stdout_output=$("$SHIM" test 2>/dev/null)
  stderr_output=$("$SHIM" test 2>&1 >/dev/null)

  assert_contains "$stdout_output" "stdout msg" || return 1
  assert_contains "$stderr_output" "stderr msg" || return 1
}

# shellcheck disable=SC2317
test_empty_response_handled() {
  # shellcheck disable=SC2089,SC2090
  export MOCK_RESPONSE='{"ok":true,"data":{"stdout":"","stderr":"","exitCode":0}}'

  set +e
  "$SHIM" test >/dev/null 2>&1
  exit_code=$?
  set -e

  assert_equals "0" "$exit_code"
}

# shellcheck disable=SC2317
test_json_special_chars_in_output() {
  # Response with JSON containing special characters
  # shellcheck disable=SC2089,SC2090
  export MOCK_RESPONSE='{"ok":true,"data":{"stdout":"{\"key\":\"value\"}","stderr":"","exitCode":0}}'

  output=$("$SHIM" test 2>&1)

  assert_contains "$output" '"key"' || return 1
  assert_contains "$output" '"value"' || return 1
}

# shellcheck disable=SC2317
test_multiline_output() {
  # Multiple newlines in output
  # shellcheck disable=SC2089,SC2090
  export MOCK_RESPONSE='{"ok":true,"data":{"stdout":"line1\nline2\nline3","stderr":"","exitCode":0}}'

  output=$("$SHIM" test 2>&1)

  assert_contains "$output" "line1" || return 1
  assert_contains "$output" "line2" || return 1
  assert_contains "$output" "line3" || return 1
}

# ============================================================================
# MAIN
# ============================================================================

main() {
  printf "Running gog shim tests...\n\n"

  # Check jq is available (required for shim to work properly)
  if ! command -v jq >/dev/null 2>&1; then
    printf "%sERROR: jq is required but not installed%s\n" "$RED" "$NC"
    exit 1
  fi

  run_test test_newline_in_json_becomes_actual_newline
  run_test test_literal_backslash_n_preserved
  run_test test_tab_characters_preserved
  run_test test_exit_code_propagates
  run_test test_error_response_handled
  run_test test_stderr_goes_to_stderr
  run_test test_empty_response_handled
  run_test test_json_special_chars_in_output
  run_test test_multiline_output

  printf "\n"
  if [ "$TESTS_PASSED" -eq "$TESTS_RUN" ]; then
    printf "%sAll %d tests passed!%s\n" "$GREEN" "$TESTS_RUN" "$NC"
    exit 0
  else
    printf "%s%d/%d tests passed%s\n" "$RED" "$TESTS_PASSED" "$TESTS_RUN" "$NC"
    exit 1
  fi
}

main "$@"
