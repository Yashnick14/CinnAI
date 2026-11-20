"""Operator-only admin provisioning using a verified Firebase Console UID.

Requires the migration/operator database connection, never the application's
restricted database credentials. Passwords remain exclusively in Firebase.
"""
import argparse
from .database import sessions
from .models import Admin, User


def seed_admin(session, uid: str, name: str):
    """Idempotently assign admin membership without changing grading records."""
    if not uid.strip() or len(uid) > 128 or not name.strip() or len(name) > 100:
        raise ValueError("Supply a valid Firebase UID and display name.")
    user = session.get(User, uid)
    if user is None:
        user = User(uid=uid, display_name=name)
        session.add(user)
        session.flush()
    if session.get(Admin, uid) is None:
        session.add(Admin(user_uid=uid))
    session.commit()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uid", required=True, help="UID verified in Firebase Authentication Users")
    parser.add_argument("--name", default="Yashnick")
    args = parser.parse_args()
    with sessions()() as session:
        seed_admin(session, args.uid, args.name)
    print("Administrator membership saved. No passwords stored or changed.")


if __name__ == "__main__":
    main()
