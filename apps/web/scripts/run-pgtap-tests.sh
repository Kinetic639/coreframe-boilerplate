#!/bin/bash

# pgTAP Test Runner Script
# This script helps run all Phase 1 security tests

echo "=========================================="
echo "pgTAP Test Files Found:"
echo "=========================================="

cd /home/user/coreframe-boilerplate

for test_file in supabase/tests/*.sql; do
    if [ -f "$test_file" ]; then
        echo "  - $(basename $test_file)"
    fi
done

echo ""
echo "=========================================="
echo "To run these tests:"
echo "=========================================="
echo ""
echo "Use Supabase MCP through Claude:"
echo "  mcp__supabase__execute_sql with content from each file"
echo ""
echo "Total test files: $(ls -1 supabase/tests/*.sql 2>/dev/null | wc -l)"
