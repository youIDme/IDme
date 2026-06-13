import unittest
from datetime import datetime, timezone
from pydantic import ValidationError

from src.routes.profile import _generate_ai_summary
from src.schemas import IDmeProfileResponse, VerificationResponse


# Mock User and Trust classes for testing
class MockUser:
    def __init__(self, slug, display_name, created_at):
        self.slug = slug
        self.display_name = display_name
        self.created_at = created_at


class MockTrust:
    def __init__(self, total_score):
        self.total_score = total_score


class TestAIFeatures(unittest.TestCase):
    def test_generate_ai_summary(self):
        user = MockUser(
            slug="testuser",
            display_name="Test User",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        trust = MockTrust(total_score=85)
        
        verifications = {
            "github": {
                "username": "testuser_gh",
                "verified_at": "2026-06-13T00:00:00Z",
                "metadata": {
                    "public_repos": 12,
                    "followers": 45,
                    "company": "TestCorp",
                    "location": "San Francisco",
                    "bio": "Open source developer",
                    "html_url": "https://github.com/testuser_gh",
                }
            },
            "linkedin": {
                "username": "testuser_li",
                "verified_at": "2026-06-13T00:00:00Z",
                "metadata": {
                    "given_name": "Test",
                    "family_name": "User",
                    "email": "test@user.com",
                    "locale": "en_US",
                }
            }
        }
        
        summary = _generate_ai_summary(user, trust, verifications)
        
        # Assert key details are in the summary
        self.assertIn("IDme Profile Summary for Test User (@testuser)", summary)
        self.assertIn("Overall Identity Trust Score: 85/100", summary)
        self.assertIn("GITHUB: username='testuser_gh'", summary)
        self.assertIn("Repositories: 12", summary)
        self.assertIn("Followers: 45", summary)
        self.assertIn("Company: TestCorp", summary)
        self.assertIn("Location: San Francisco", summary)
        self.assertIn("Bio: Open source developer", summary)
        self.assertIn("LINKEDIN: username='testuser_li'", summary)
        self.assertIn("Verified Name: Test User", summary)
        self.assertIn("Email: test@user.com", summary)
        
    def test_pydantic_schemas(self):
        # Verify VerificationResponse can serialize metadata
        v_resp = VerificationResponse(
            platform="github",
            status="verified",
            username="testuser_gh",
            verified_at=datetime.now(timezone.utc),
            metadata={
                "public_repos": 10,
                "followers": 5,
            }
        )
        self.assertEqual(v_resp.metadata["public_repos"], 10)
        self.assertEqual(v_resp.metadata["followers"], 5)
        
        # Verify IDmeProfileResponse can serialize the new schema
        profile_resp = IDmeProfileResponse(
            slug="testuser",
            display_name="Test User",
            trust_score=85,
            verifications={"github": v_resp},
            created_at=datetime.now(timezone.utc),
            profile_url="https://idme.io/testuser",
            ai_summary="This is an AI summary context."
        )
        self.assertEqual(profile_resp.ai_summary, "This is an AI summary context.")


if __name__ == "__main__":
    unittest.main()
