#pragma once
// Copy to cloud_credentials.h locally. Never commit that file.
#define CLOUD_ENABLED 0
// Set your backend HTTPS base URL in the private cloud_credentials.h.
#define CLOUD_BASE_URL ""
#define CLOUD_DEVICE_ID "cinnai-probe-001"
// Operator provisions this device; the token is copied to firmware via USB only.
#define CLOUD_DEVICE_TOKEN ""
// Supply a current trusted root CA PEM for the Azure endpoint certificate chain.
// Obtain from the CA's official site and verify its fingerprint out of band.
// Blank CA FAILS CLOSED; never substitute setInsecure().
static const char CLOUD_ROOT_CA[] = R"PEM(
)PEM";
