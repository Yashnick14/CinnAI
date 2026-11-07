import hashlib
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path
from archive_identity import image_ids


class ArchiveIdentityTests(unittest.TestCase):
    def check_archive(self, *, wrong=False, corrupt=False, oci=True, platform="amd64"):
        config = json.dumps({"os": "linux", "architecture": platform}).encode()
        config_id = "sha256:" + hashlib.sha256(config).hexdigest()
        manifest = json.dumps({"config": {"digest": config_id}}).encode()
        manifest_id = "sha256:" + hashlib.sha256(manifest).hexdigest()
        config_path = "blobs/sha256/" + config_id.split(":")[1]
        files = {config_path: config, "manifest.json": json.dumps([{"Config": config_path}]).encode()}
        if oci:
            files["index.json"] = json.dumps({"manifests": [{"digest": manifest_id}]}).encode()
            files["blobs/sha256/" + manifest_id.split(":")[1]] = b"{}" if corrupt else manifest
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "image.tar"
            with tarfile.open(path, "w") as archive:
                for name, data in files.items():
                    item = tarfile.TarInfo(name)
                    item.size = len(data)
                    archive.addfile(item, io.BytesIO(data))
            return image_ids(path, "sha256:" + "0" * 64 if wrong else config_id), config_id, manifest_id

    def test_oci_configuration_and_manifest(self):
        ids, config, manifest = self.check_archive()
        self.assertEqual(ids, [config, manifest])

    def test_classic(self):
        ids, config, _ = self.check_archive(oci=False)
        self.assertEqual(ids, [config])

    def test_wrong_tested_image(self):
        with self.assertRaises(ValueError):
            self.check_archive(wrong=True)

    def test_corrupt_manifest(self):
        with self.assertRaises(ValueError):
            self.check_archive(corrupt=True)

    def test_wrong_platform(self):
        with self.assertRaises(ValueError):
            self.check_archive(platform="arm64")


if __name__ == "__main__":
    unittest.main()
