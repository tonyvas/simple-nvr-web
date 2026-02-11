#!/usr/bin/bash

SCRIPT_DIR=$(realpath $(dirname "$0"))
LOG_DIR="${SCRIPT_DIR}/logs"

cd "${SCRIPT_DIR}"
mkdir -p "${LOG_DIR}"

npm run start 2>&1 | tee "${LOG_DIR}/$(date +%Y%m%d_%H%M%S).log"