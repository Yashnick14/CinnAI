import json
import time
from datetime import datetime, timedelta, timezone
import jwt
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from app.cloud.auth import verify_firebase

@pytest.fixture
def signed(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537,key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,"test-only")])
    certificate = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
        .public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc)-timedelta(minutes=1))
        .not_valid_after(datetime.now(timezone.utc)+timedelta(days=1)).sign(key,hashes.SHA256()))
    cert = certificate.public_bytes(serialization.Encoding.PEM).decode()
    class Response:
        status=200
        data=json.dumps({"test-key":cert}).encode()
    monkeypatch.setenv("FIREBASE_PROJECT_ID","cinnai-test")
    monkeypatch.setattr("app.cloud.auth.certificate_request",lambda:lambda *args, **kwargs:Response())
    claims={"sub":"alice","aud":"cinnai-test","iss":"https://securetoken.google.com/cinnai-test",
        "iat":int(time.time())-10,"exp":int(time.time())+1000,"auth_time":int(time.time())-20}
    def token(updates=None, signing_key=None):
        return jwt.encode({**claims,**(updates or {})},signing_key or key,algorithm="RS256",headers={"kid":"test-key"})
    return token

def test_real_signature_verified(signed):
    assert verify_firebase(signed()) == "alice"

@pytest.mark.parametrize("updates", [{"aud":"other"},{"iss":"https://evil.test"},
    {"exp":1},{"iat":9999999999},{"sub":""},{"auth_time":9999999999}])
def test_rejects_invalid_claims(signed,updates):
    with pytest.raises(Exception): verify_firebase(signed(updates))

def test_rejects_forged_signature(signed):
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    with pytest.raises(Exception): verify_firebase(signed(signing_key=key))
