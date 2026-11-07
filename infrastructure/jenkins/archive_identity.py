"""Read only: bind an OCI manifest to the tested Docker configuration digest.

Caller must first verify the complete archive SHA256 against the Jenkins bundle.
No archive members are extracted to disk. Requires Python 3 standard library only.
"""
import hashlib
import json
import re
import sys
import tarfile


def image_ids(path, expected):
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", expected):
        raise ValueError("Invalid tested configuration digest")
    with tarfile.open(path) as archive:
        members = archive.getmembers()
        names = [m.name for m in members]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate archive members")

        def read(name):
            member = archive.getmember(name)
            if not member.isfile() or member.size > 4 * 1024 * 1024:
                raise ValueError("Invalid metadata member")
            return archive.extractfile(member).read()

        def blob(digest):
            if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
                raise ValueError("Invalid blob digest")
            data = read("blobs/sha256/" + digest.split(":")[1])
            if "sha256:" + hashlib.sha256(data).hexdigest() != digest:
                raise ValueError("Blob checksum mismatch")
            return json.loads(data)

        docker_manifest = json.loads(read("manifest.json"))
        if len(docker_manifest) != 1:
            raise ValueError("Expected one tested image")
        config_bytes = read(docker_manifest[0]["Config"])
        if "sha256:" + hashlib.sha256(config_bytes).hexdigest() != expected:
            raise ValueError("Archive does not contain tested configuration")
        config = json.loads(config_bytes)
        if (config.get("os"), config.get("architecture")) != ("linux", "amd64"):
            raise ValueError("Expected Linux/amd64 configuration")
        ids = [expected]
        if "index.json" in names:
            index = json.loads(read("index.json"))
            # Only accept direct, hash-verified image manifests for this configuration.
            for descriptor in index.get("manifests", []):
                digest = descriptor["digest"]
                manifest = blob(digest)
                if manifest.get("config", {}).get("digest") == expected:
                    blob(expected)
                    ids.append(digest)
        return list(dict.fromkeys(ids))


if __name__ == "__main__":
    print(json.dumps(image_ids(sys.argv[1], sys.argv[2])))
