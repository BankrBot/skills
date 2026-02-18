#!/bin/bash
# Wrapper script for get-gotchi.js

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "$1" ]; then
    echo "Usage: gotchi-info.sh <gotchi-id>"
    echo "Example: gotchi-info.sh 12345"
    exit 1
fi

cd "$SCRIPT_DIR" && node get-gotchi.js "$1"
