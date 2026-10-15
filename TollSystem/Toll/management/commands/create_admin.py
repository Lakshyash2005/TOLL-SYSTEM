"""
Management command: create_admin

Usage:
    python manage.py create_admin --username admin --email admin@example.com --password secret123

Creates a User + UserProfile(role=ADMIN) safely.
Will not overwrite an existing account unless --force is passed.
"""
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from Toll.models import UserProfile, Wallet


class Command(BaseCommand):
    help = "Create a TollFlow administrator account safely."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True, help="Administrator username")
        parser.add_argument("--email", default="", help="Administrator email address")
        parser.add_argument("--password", required=True, help="Administrator password (min 8 chars)")
        parser.add_argument(
            "--force",
            action="store_true",
            default=False,
            help="Update role to ADMIN if the user already exists",
        )

    def handle(self, *args, **options):
        username = options["username"].strip()
        email = options["email"].strip()
        password = options["password"]

        if len(password) < 8:
            raise CommandError("Password must be at least 8 characters.")

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )

        if not created and not options["force"]:
            raise CommandError(
                f"User '{username}' already exists. "
                "Use --force to update their role to ADMIN."
            )

        user.set_password(password)
        user.email = email
        user.is_staff = True
        user.is_superuser = True
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserProfile.ADMIN
        profile.save()

        Wallet.objects.get_or_create(user=user)

        self.stdout.write(
            self.style.SUCCESS(
                f"[OK] Admin account '{username}' ready. Role: ADMIN."
            )
        )
