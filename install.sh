#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPO="sobanieca/imp-ui"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="imp"

echo "Installing imp..."
echo ""

OS="$(uname -s)"
case "$OS" in
  Linux*)
    OS_TYPE="linux"
    ;;
  Darwin*)
    OS_TYPE="macos"
    ;;
  *)
    echo -e "${RED}Error: Unsupported operating system: $OS${NC}"
    echo "Supported: Linux, macOS"
    exit 1
    ;;
esac

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)
    ARCH_TYPE="x64"
    ;;
  aarch64|arm64)
    ARCH_TYPE="arm64"
    ;;
  *)
    echo -e "${RED}Error: Unsupported architecture: $ARCH${NC}"
    echo "Supported: x86_64, arm64"
    exit 1
    ;;
esac

BINARY_FILE="imp-${OS_TYPE}-${ARCH_TYPE}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

require_downloader() {
  if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
    echo -e "${RED}Error: Neither curl nor wget is available${NC}"
    echo "Please install curl or wget and try again"
    exit 1
  fi
}

download() {
  if command -v curl &> /dev/null; then
    curl -fsSL -o "$2" "$1"
  else
    wget -q -O "$2" "$1"
  fi
}

latest_release_url() {
  local url="https://github.com/${REPO}/releases/latest"
  if command -v curl &> /dev/null; then
    curl -fsSLI -o /dev/null -w '%{url_effective}' "${url}"
  else
    wget -q -S --spider --max-redirect=0 "${url}" 2>&1 | sed -n 's/^ *[Ll]ocation: *//p' | tr -d '\r' | tail -n 1
  fi
}

require_downloader

echo "Resolving the latest release..."
RELEASE_URL="$(latest_release_url || true)"
TAG="${RELEASE_URL##*/tag/}"
if [ -z "${RELEASE_URL}" ] || [ "${TAG}" = "${RELEASE_URL}" ] || [ -z "${TAG}" ]; then
  echo -e "${RED}Error: Could not resolve the latest imp release${NC}"
  exit 1
fi

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${BINARY_FILE}"

echo "Detected system: ${OS_TYPE}-${ARCH_TYPE}"
echo "Release: ${TAG}"
echo "Download URL: ${DOWNLOAD_URL}"
echo ""

echo "Downloading imp..."
download "${DOWNLOAD_URL}" "${TMP_DIR}/${BINARY_NAME}"
download "${DOWNLOAD_URL}.sha256" "${TMP_DIR}/${BINARY_NAME}.sha256"

echo "Verifying the checksum..."
EXPECTED="$(awk '{print $1}' "${TMP_DIR}/${BINARY_NAME}.sha256")"
if command -v sha256sum &> /dev/null; then
  ACTUAL="$(sha256sum "${TMP_DIR}/${BINARY_NAME}" | awk '{print $1}')"
elif command -v shasum &> /dev/null; then
  ACTUAL="$(shasum -a 256 "${TMP_DIR}/${BINARY_NAME}" | awk '{print $1}')"
else
  echo -e "${RED}Error: Neither sha256sum nor shasum is available${NC}"
  exit 1
fi
if [ "${EXPECTED}" != "${ACTUAL}" ]; then
  echo -e "${RED}Error: The checksum of the download does not match the published one${NC}"
  echo "Expected: ${EXPECTED}"
  echo "Actual:   ${ACTUAL}"
  exit 1
fi

chmod +x "${TMP_DIR}/${BINARY_NAME}"

if [ -w "$INSTALL_DIR" ]; then
  SUDO=""
else
  SUDO="sudo"
  echo -e "${YELLOW}Note: sudo is required to install to ${INSTALL_DIR}${NC}"
fi

echo "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
$SUDO mv "${TMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"

echo ""
echo -e "${GREEN}imp has been installed successfully${NC}"
echo ""
echo "Run 'imp help' to get started"
echo ""

if command -v imp &> /dev/null; then
  VERSION=$(imp --version 2>&1 || echo "unknown")
  echo "Installed version: ${VERSION}"
else
  echo -e "${YELLOW}Warning: ${INSTALL_DIR} may not be in your PATH${NC}"
  echo "Add it to your PATH or move the binary to a directory in your PATH"
fi
