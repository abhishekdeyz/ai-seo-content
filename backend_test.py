#!/usr/bin/env python3
"""
Backend API tests for SEOForge AI
Tests all backend endpoints according to the test plan
"""

import requests
import json
import time
from datetime import datetime

# Base URL from .env
BASE_URL = "https://bulk-seo-ops.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test user credentials
TEST_EMAIL = f"test_user_{int(time.time())}@example.com"
TEST_PASSWORD = "testpass123"
TEST_NAME = "Test User"

# Session for maintaining cookies
session = requests.Session()

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def print_response(resp):
    print(f"Status: {resp.status_code}")
    try:
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
    except:
        print(f"Response (text): {resp.text[:500]}")

# Test 1: POST /api/signup
def test_signup():
    print_test("POST /api/signup - Create new user")
    try:
        resp = session.post(f"{API_BASE}/signup", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        })
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and "email" in data and "name" in data:
                print_result(True, "Signup successful, returns id/email/name")
                return True
            else:
                print_result(False, "Missing required fields in response")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 2: Duplicate signup should fail
def test_duplicate_signup():
    print_test("POST /api/signup - Duplicate email should return 409")
    try:
        resp = session.post(f"{API_BASE}/signup", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        })
        print_response(resp)
        
        if resp.status_code == 409:
            data = resp.json()
            if "error" in data:
                print_result(True, "Duplicate email correctly returns 409 with error message")
                return True
            else:
                print_result(False, "409 but no error field")
                return False
        else:
            print_result(False, f"Expected 409, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 3: Signup with short password
def test_short_password():
    print_test("POST /api/signup - Short password should return 400")
    try:
        resp = session.post(f"{API_BASE}/signup", json={
            "email": f"short_{int(time.time())}@example.com",
            "password": "123",
            "name": "Short"
        })
        print_response(resp)
        
        if resp.status_code == 400:
            print_result(True, "Short password correctly returns 400")
            return True
        else:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 4: NextAuth login flow
def test_nextauth_login():
    print_test("NextAuth login flow - Sign in with credentials")
    try:
        # Step 1: Get CSRF token
        print("\nStep 1: Getting CSRF token...")
        csrf_resp = session.get(f"{API_BASE}/auth/csrf")
        print_response(csrf_resp)
        
        if csrf_resp.status_code != 200:
            print_result(False, f"Failed to get CSRF token: {csrf_resp.status_code}")
            return False
        
        csrf_token = csrf_resp.json().get("csrfToken")
        if not csrf_token:
            print_result(False, "No csrfToken in response")
            return False
        
        print(f"CSRF Token: {csrf_token}")
        
        # Step 2: Sign in
        print("\nStep 2: Signing in...")
        signin_resp = session.post(
            f"{API_BASE}/auth/callback/credentials",
            data={
                "csrfToken": csrf_token,
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "json": "true",
                "callbackUrl": f"{BASE_URL}/dashboard"
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        print_response(signin_resp)
        
        # Step 3: Verify session
        print("\nStep 3: Verifying session...")
        session_resp = session.get(f"{API_BASE}/auth/session")
        print_response(session_resp)
        
        if session_resp.status_code == 200:
            session_data = session_resp.json()
            if session_data.get("user") and session_data["user"].get("id"):
                print_result(True, "Login successful, session established")
                return True
            else:
                print_result(False, "Session exists but no user.id")
                return False
        else:
            print_result(False, f"Failed to get session: {session_resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 5: GET /api/me with auth
def test_me_with_auth():
    print_test("GET /api/me - With authentication")
    try:
        resp = session.get(f"{API_BASE}/me")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and "email" in data and "credits" in data:
                if data.get("credits") == 100:
                    print_result(True, "Returns user with id, email, credits=100")
                    return True
                else:
                    print_result(False, f"Credits should be 100, got {data.get('credits')}")
                    return False
            else:
                print_result(False, "Missing required fields")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 6: GET /api/me without auth
def test_me_without_auth():
    print_test("GET /api/me - Without authentication should return 401")
    try:
        # Create new session without cookies
        no_auth_session = requests.Session()
        resp = no_auth_session.get(f"{API_BASE}/me")
        print_response(resp)
        
        if resp.status_code == 401:
            print_result(True, "Correctly returns 401 without auth")
            return True
        else:
            print_result(False, f"Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 7: GET /api/dashboard/stats
def test_dashboard_stats():
    print_test("GET /api/dashboard/stats - Dashboard statistics")
    try:
        resp = session.get(f"{API_BASE}/dashboard/stats")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            required_fields = ["credits", "completedArticles", "processingArticles", 
                             "failedArticles", "totalArticles", "serpRequests", "recent"]
            missing = [f for f in required_fields if f not in data]
            if not missing:
                print_result(True, "Returns all required stats fields")
                return True
            else:
                print_result(False, f"Missing fields: {missing}")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 8: POST /api/serp/analyze
def test_serp_analyze():
    print_test("POST /api/serp/analyze - SERP analysis")
    try:
        resp = session.post(f"{API_BASE}/serp/analyze", json={
            "keyword": "best running shoes",
            "country": "us",
            "language": "en"
        })
        print_response(resp)
        
        # If SERPER_API_KEY is placeholder, expect 502
        if resp.status_code == 502:
            data = resp.json()
            if "error" in data and "SERPER_API_KEY" in data["error"]:
                print_result(True, "SERPER_API_KEY placeholder detected, returns 502 with clear error")
                return True
            else:
                print_result(False, "502 but error message doesn't mention SERPER_API_KEY")
                return False
        elif resp.status_code == 200:
            data = resp.json()
            # Check for expected fields
            if "organic" in data or "intent" in data:
                print_result(True, "SERP analysis successful with real API key")
                return True
            else:
                print_result(False, "200 but missing expected fields")
                return False
        else:
            print_result(False, f"Unexpected status code: {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 9: POST /api/serp/analyze without keyword
def test_serp_analyze_no_keyword():
    print_test("POST /api/serp/analyze - Missing keyword should return 400")
    try:
        resp = session.post(f"{API_BASE}/serp/analyze", json={
            "country": "us",
            "language": "en"
        })
        print_response(resp)
        
        if resp.status_code == 400:
            print_result(True, "Missing keyword correctly returns 400")
            return True
        else:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 10: POST /api/generate
def test_generate_article():
    print_test("POST /api/generate - Single article generation")
    try:
        resp = session.post(f"{API_BASE}/generate", json={
            "primaryKeyword": "test article generation",
            "secondaryKeywords": ["seo", "content"],
            "country": "us",
            "language": "en",
            "wordCount": 1000
        })
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("status") == "queued":
                print_result(True, "Article queued successfully, returns id and status='queued'")
                # Store article ID for later tests
                global ARTICLE_ID
                ARTICLE_ID = data["id"]
                return True
            else:
                print_result(False, "Missing id or status != 'queued'")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 11: POST /api/generate without primaryKeyword
def test_generate_no_keyword():
    print_test("POST /api/generate - Missing primaryKeyword should return 400")
    try:
        resp = session.post(f"{API_BASE}/generate", json={
            "secondaryKeywords": ["seo"],
            "country": "us"
        })
        print_response(resp)
        
        if resp.status_code == 400:
            print_result(True, "Missing primaryKeyword correctly returns 400")
            return True
        else:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 12: POST /api/bulk
def test_bulk_job():
    print_test("POST /api/bulk - Bulk job creation")
    try:
        resp = session.post(f"{API_BASE}/bulk", json={
            "name": "Test Bulk Job",
            "rows": [
                {"primary_keyword": "keyword one"},
                {"primary_keyword": "keyword two"}
            ],
            "defaults": {
                "country": "us",
                "language": "en",
                "wordCount": 1000
            }
        })
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("totalArticles") == 2:
                print_result(True, "Bulk job created with totalArticles=2")
                # Store job ID for later tests
                global JOB_ID
                JOB_ID = data["id"]
                return True
            else:
                print_result(False, f"Missing id or totalArticles != 2 (got {data.get('totalArticles')})")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 13: POST /api/bulk with empty rows
def test_bulk_empty_rows():
    print_test("POST /api/bulk - Empty rows should return 400")
    try:
        resp = session.post(f"{API_BASE}/bulk", json={
            "name": "Empty Job",
            "rows": [],
            "defaults": {"country": "us"}
        })
        print_response(resp)
        
        if resp.status_code == 400:
            print_result(True, "Empty rows correctly returns 400")
            return True
        else:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 14: GET /api/articles
def test_list_articles():
    print_test("GET /api/articles - List articles")
    try:
        resp = session.get(f"{API_BASE}/articles")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "items" in data and "total" in data and "page" in data and "limit" in data:
                print_result(True, "Returns articles list with pagination")
                return True
            else:
                print_result(False, "Missing required pagination fields")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 15: GET /api/articles with filters
def test_list_articles_with_filters():
    print_test("GET /api/articles - With filters")
    try:
        resp = session.get(f"{API_BASE}/articles?status=queued&limit=5")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "items" in data:
                print_result(True, "Filters work correctly")
                return True
            else:
                print_result(False, "Missing items field")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 16: GET /api/articles/:id
def test_get_article():
    print_test("GET /api/articles/:id - Get single article")
    try:
        if not ARTICLE_ID:
            print_result(False, "No article ID available from previous test")
            return False
        
        resp = session.get(f"{API_BASE}/articles/{ARTICLE_ID}")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data["id"] == ARTICLE_ID:
                # Check that _id is not exposed
                if "_id" in data:
                    print_result(False, "MongoDB _id field is exposed (should be stripped)")
                    return False
                print_result(True, "Returns article without _id field")
                return True
            else:
                print_result(False, "Article ID mismatch or missing")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 17: GET /api/articles/:id with invalid ID
def test_get_article_not_found():
    print_test("GET /api/articles/:id - Invalid ID should return 404")
    try:
        resp = session.get(f"{API_BASE}/articles/invalid-id-12345")
        print_response(resp)
        
        if resp.status_code == 404:
            print_result(True, "Invalid ID correctly returns 404")
            return True
        else:
            print_result(False, f"Expected 404, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 18: PUT /api/articles/:id
def test_update_article():
    print_test("PUT /api/articles/:id - Update article")
    try:
        if not ARTICLE_ID:
            print_result(False, "No article ID available from previous test")
            return False
        
        resp = session.put(f"{API_BASE}/articles/{ARTICLE_ID}", json={
            "title": "Updated Test Title",
            "markdown": "# Updated Content\n\nThis is updated content."
        })
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("title") == "Updated Test Title":
                print_result(True, "Article updated successfully")
                return True
            else:
                print_result(False, "Title not updated")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 19: GET /api/articles/:id/export
def test_export_article():
    print_test("GET /api/articles/:id/export - Export formats")
    try:
        if not ARTICLE_ID:
            print_result(False, "No article ID available from previous test")
            return False
        
        formats = {
            "html": "text/html",
            "markdown": "text/markdown",
            "txt": "text/plain",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
        
        all_passed = True
        for fmt, expected_content_type in formats.items():
            print(f"\nTesting format: {fmt}")
            resp = session.get(f"{API_BASE}/articles/{ARTICLE_ID}/export?format={fmt}")
            print(f"Status: {resp.status_code}")
            print(f"Content-Type: {resp.headers.get('Content-Type')}")
            
            if resp.status_code == 200:
                content_type = resp.headers.get('Content-Type', '')
                if expected_content_type in content_type:
                    print(f"✓ {fmt} export works with correct content-type")
                else:
                    print(f"✗ {fmt} wrong content-type: expected {expected_content_type}, got {content_type}")
                    all_passed = False
            else:
                print(f"✗ {fmt} export failed with status {resp.status_code}")
                all_passed = False
        
        if all_passed:
            print_result(True, "All export formats work correctly")
            return True
        else:
            print_result(False, "Some export formats failed")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 20: GET /api/articles/:id/export with invalid ID
def test_export_not_found():
    print_test("GET /api/articles/:id/export - Invalid ID should return 404")
    try:
        resp = session.get(f"{API_BASE}/articles/invalid-id-12345/export?format=html")
        print_response(resp)
        
        if resp.status_code == 404:
            print_result(True, "Invalid ID correctly returns 404")
            return True
        else:
            print_result(False, f"Expected 404, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 21: DELETE /api/articles/:id
def test_delete_article():
    print_test("DELETE /api/articles/:id - Delete article")
    try:
        if not ARTICLE_ID:
            print_result(False, "No article ID available from previous test")
            return False
        
        resp = session.delete(f"{API_BASE}/articles/{ARTICLE_ID}")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True:
                print_result(True, "Article deleted successfully")
                return True
            else:
                print_result(False, "Delete response missing ok:true")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 22: GET /api/jobs
def test_list_jobs():
    print_test("GET /api/jobs - List jobs")
    try:
        resp = session.get(f"{API_BASE}/jobs")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                print_result(True, "Returns jobs list")
                return True
            else:
                print_result(False, "Response is not a list")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 23: GET /api/jobs/:id
def test_get_job():
    print_test("GET /api/jobs/:id - Get job details")
    try:
        if not JOB_ID:
            print_result(False, "No job ID available from previous test")
            return False
        
        resp = session.get(f"{API_BASE}/jobs/{JOB_ID}")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and "articles" in data:
                # Check that _id is not exposed
                if "_id" in data:
                    print_result(False, "MongoDB _id field is exposed (should be stripped)")
                    return False
                print_result(True, "Returns job with articles array, no _id field")
                return True
            else:
                print_result(False, "Missing id or articles field")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 24: GET /api/jobs/:id with invalid ID
def test_get_job_not_found():
    print_test("GET /api/jobs/:id - Invalid ID should return 404")
    try:
        resp = session.get(f"{API_BASE}/jobs/invalid-job-id-12345")
        print_response(resp)
        
        if resp.status_code == 404:
            print_result(True, "Invalid job ID correctly returns 404")
            return True
        else:
            print_result(False, f"Expected 404, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Global variables for storing IDs
ARTICLE_ID = None
JOB_ID = None
PROJECT_ID = None
BULK_JOB_ID = None

# ============= v2 TESTS =============

# Test 25: POST /api/projects - Create project
def test_create_project():
    print_test("POST /api/projects - Create project")
    try:
        resp = session.post(f"{API_BASE}/projects", json={
            "name": "Client X",
            "websiteUrl": "https://x.com",
            "description": "test project"
        })
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and "userId" in data and data.get("name") == "Client X":
                print_result(True, "Project created successfully with id, userId, name")
                global PROJECT_ID
                PROJECT_ID = data["id"]
                return True
            else:
                print_result(False, "Missing required fields in response")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 26: POST /api/projects - Missing name should return 400
def test_create_project_no_name():
    print_test("POST /api/projects - Missing name should return 400")
    try:
        resp = session.post(f"{API_BASE}/projects", json={
            "websiteUrl": "https://example.com",
            "description": "test"
        })
        print_response(resp)
        
        if resp.status_code == 400:
            print_result(True, "Missing name correctly returns 400")
            return True
        else:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 27: GET /api/projects - List projects with articleCount
def test_list_projects():
    print_test("GET /api/projects - List projects with articleCount")
    try:
        resp = session.get(f"{API_BASE}/projects")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                # Check if each project has articleCount field
                if len(data) > 0:
                    if "articleCount" in data[0]:
                        print_result(True, "Returns projects list with articleCount field")
                        return True
                    else:
                        print_result(False, "Missing articleCount field")
                        return False
                else:
                    print_result(True, "Returns empty projects list (valid)")
                    return True
            else:
                print_result(False, "Response is not a list")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 28: GET /api/projects/:id - Get single project
def test_get_project():
    print_test("GET /api/projects/:id - Get single project")
    try:
        if not PROJECT_ID:
            print_result(False, "No project ID available from previous test")
            return False
        
        resp = session.get(f"{API_BASE}/projects/{PROJECT_ID}")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data["id"] == PROJECT_ID:
                if "_id" in data:
                    print_result(False, "MongoDB _id field is exposed")
                    return False
                print_result(True, "Returns project without _id field")
                return True
            else:
                print_result(False, "Project ID mismatch or missing")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 29: PUT /api/projects/:id - Update project
def test_update_project():
    print_test("PUT /api/projects/:id - Update project")
    try:
        if not PROJECT_ID:
            print_result(False, "No project ID available from previous test")
            return False
        
        resp = session.put(f"{API_BASE}/projects/{PROJECT_ID}", json={
            "name": "Updated Client X"
        })
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True:
                print_result(True, "Project updated successfully")
                return True
            else:
                print_result(False, "Update response missing ok:true")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 30: POST /api/generate with projectId
def test_generate_with_project():
    print_test("POST /api/generate - With projectId")
    try:
        if not PROJECT_ID:
            print_result(False, "No project ID available from previous test")
            return False
        
        resp = session.post(f"{API_BASE}/generate", json={
            "primaryKeyword": "test seo",
            "projectId": PROJECT_ID
        })
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("status") == "queued":
                # Verify article has projectId
                article_id = data["id"]
                time.sleep(0.5)  # Brief wait
                article_resp = session.get(f"{API_BASE}/articles/{article_id}")
                if article_resp.status_code == 200:
                    article_data = article_resp.json()
                    if article_data.get("projectId") == PROJECT_ID:
                        print_result(True, "Article created with projectId")
                        return True
                    else:
                        print_result(False, f"Article projectId mismatch: expected {PROJECT_ID}, got {article_data.get('projectId')}")
                        return False
                else:
                    print_result(False, "Failed to verify article projectId")
                    return False
            else:
                print_result(False, "Missing id or status != 'queued'")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 31: POST /api/bulk with projectId
def test_bulk_with_project():
    print_test("POST /api/bulk - With projectId")
    try:
        if not PROJECT_ID:
            print_result(False, "No project ID available from previous test")
            return False
        
        resp = session.post(f"{API_BASE}/bulk", json={
            "name": "Batch with Project",
            "rows": [
                {"primary_keyword": "keyword a"},
                {"primary_keyword": "keyword b"}
            ],
            "defaults": {"country": "us"},
            "projectId": PROJECT_ID
        })
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("projectId") == PROJECT_ID:
                print_result(True, "Bulk job created with projectId")
                global BULK_JOB_ID
                BULK_JOB_ID = data["id"]
                return True
            else:
                print_result(False, f"Missing id or projectId mismatch")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 32: GET /api/articles?projectId=PROJECT_ID
def test_articles_filter_by_project():
    print_test("GET /api/articles?projectId=PROJECT_ID - Filter by project")
    try:
        if not PROJECT_ID:
            print_result(False, "No project ID available from previous test")
            return False
        
        resp = session.get(f"{API_BASE}/articles?projectId={PROJECT_ID}")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "items" in data:
                # Verify all items have the correct projectId
                items = data["items"]
                if len(items) > 0:
                    all_match = all(item.get("projectId") == PROJECT_ID for item in items)
                    if all_match:
                        print_result(True, f"All {len(items)} articles have correct projectId")
                        return True
                    else:
                        print_result(False, "Some articles have wrong projectId")
                        return False
                else:
                    print_result(True, "No articles yet (valid)")
                    return True
            else:
                print_result(False, "Missing items field")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 33: GET /api/articles?projectId=none
def test_articles_filter_no_project():
    print_test("GET /api/articles?projectId=none - Filter articles with no project")
    try:
        resp = session.get(f"{API_BASE}/articles?projectId=none")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "items" in data:
                items = data["items"]
                # Verify all items have null or missing projectId
                all_null = all(item.get("projectId") is None for item in items)
                if all_null:
                    print_result(True, f"All {len(items)} articles have null projectId")
                    return True
                else:
                    print_result(False, "Some articles have non-null projectId")
                    return False
            else:
                print_result(False, "Missing items field")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 34: GET /api/articles?groupBy=website
def test_articles_group_by_website():
    print_test("GET /api/articles?groupBy=website - Group by website")
    try:
        resp = session.get(f"{API_BASE}/articles?groupBy=website")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if "items" in data and "groups" in data:
                groups = data["groups"]
                if isinstance(groups, dict):
                    print_result(True, "Returns both items and groups object")
                    return True
                else:
                    print_result(False, "groups is not an object")
                    return False
            else:
                print_result(False, "Missing items or groups field")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 35: POST /api/jobs/:id/pause
def test_job_pause():
    print_test("POST /api/jobs/:id/pause - Pause job")
    try:
        if not BULK_JOB_ID:
            print_result(False, "No bulk job ID available from previous test")
            return False
        
        resp = session.post(f"{API_BASE}/jobs/{BULK_JOB_ID}/pause")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True and data.get("paused") == True:
                # Verify job is paused
                time.sleep(0.5)
                job_resp = session.get(f"{API_BASE}/jobs/{BULK_JOB_ID}")
                if job_resp.status_code == 200:
                    job_data = job_resp.json()
                    if job_data.get("paused") == True:
                        print_result(True, "Job paused successfully")
                        return True
                    else:
                        print_result(False, "Job paused field not true")
                        return False
                else:
                    print_result(False, "Failed to verify job pause")
                    return False
            else:
                print_result(False, "Response missing ok:true or paused:true")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 36: POST /api/jobs/:id/resume
def test_job_resume():
    print_test("POST /api/jobs/:id/resume - Resume job")
    try:
        if not BULK_JOB_ID:
            print_result(False, "No bulk job ID available from previous test")
            return False
        
        resp = session.post(f"{API_BASE}/jobs/{BULK_JOB_ID}/resume")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True and data.get("paused") == False:
                # Verify job is resumed
                time.sleep(0.5)
                job_resp = session.get(f"{API_BASE}/jobs/{BULK_JOB_ID}")
                if job_resp.status_code == 200:
                    job_data = job_resp.json()
                    if job_data.get("paused") == False:
                        print_result(True, "Job resumed successfully")
                        return True
                    else:
                        print_result(False, "Job paused field not false")
                        return False
                else:
                    print_result(False, "Failed to verify job resume")
                    return False
            else:
                print_result(False, "Response missing ok:true or paused:false")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 37: POST /api/jobs/:id/retry-failed
def test_job_retry_failed():
    print_test("POST /api/jobs/:id/retry-failed - Retry failed articles")
    try:
        if not BULK_JOB_ID:
            print_result(False, "No bulk job ID available from previous test")
            return False
        
        resp = session.post(f"{API_BASE}/jobs/{BULK_JOB_ID}/retry-failed")
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True and "retried" in data:
                print_result(True, f"Retry-failed endpoint works, retried {data.get('retried')} articles")
                return True
            else:
                print_result(False, "Response missing ok:true or retried field")
                return False
        else:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 38: GET /api/jobs/:id/export - No completed articles
def test_job_export_no_completed():
    print_test("GET /api/jobs/:id/export - No completed articles should return 400")
    try:
        if not BULK_JOB_ID:
            print_result(False, "No bulk job ID available from previous test")
            return False
        
        resp = session.get(f"{API_BASE}/jobs/{BULK_JOB_ID}/export?format=html")
        print_response(resp)
        
        if resp.status_code == 400:
            data = resp.json()
            if "error" in data and "No completed articles" in data["error"]:
                print_result(True, "Correctly returns 400 with 'No completed articles' error")
                return True
            else:
                print_result(False, "400 but error message doesn't mention 'No completed articles'")
                return False
        else:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 39: GET /api/jobs/:id/export - Invalid job ID
def test_job_export_not_found():
    print_test("GET /api/jobs/:id/export - Invalid job ID should return 404")
    try:
        resp = session.get(f"{API_BASE}/jobs/invalid-job-id-12345/export?format=html")
        print_response(resp)
        
        if resp.status_code == 404:
            print_result(True, "Invalid job ID correctly returns 404")
            return True
        else:
            print_result(False, f"Expected 404, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 40: POST /api/articles/:id/rewrite - Invalid target
def test_article_rewrite_invalid_target():
    print_test("POST /api/articles/:id/rewrite - Invalid target should return 400")
    try:
        # Create a test article first
        gen_resp = session.post(f"{API_BASE}/generate", json={
            "primaryKeyword": "test rewrite article"
        })
        if gen_resp.status_code != 200:
            print_result(False, "Failed to create test article")
            return False
        
        article_id = gen_resp.json()["id"]
        time.sleep(0.5)
        
        resp = session.post(f"{API_BASE}/articles/{article_id}/rewrite", json={
            "target": "invalid_target",
            "operation": "regenerate"
        })
        print_response(resp)
        
        if resp.status_code == 400:
            print_result(True, "Invalid target correctly returns 400")
            return True
        else:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 41: POST /api/articles/:id/rewrite - Non-existent article
def test_article_rewrite_not_found():
    print_test("POST /api/articles/:id/rewrite - Non-existent article should return 404")
    try:
        resp = session.post(f"{API_BASE}/articles/invalid-article-id-12345/rewrite", json={
            "target": "title",
            "operation": "regenerate"
        })
        print_response(resp)
        
        if resp.status_code == 404:
            print_result(True, "Non-existent article correctly returns 404")
            return True
        else:
            print_result(False, f"Expected 404, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 42: POST /api/articles/:id/rewrite - OPENAI_API_KEY placeholder
def test_article_rewrite_no_openai_key():
    print_test("POST /api/articles/:id/rewrite - OPENAI_API_KEY placeholder should return 502")
    try:
        # Create a test article with some content
        gen_resp = session.post(f"{API_BASE}/generate", json={
            "primaryKeyword": "test openai rewrite"
        })
        if gen_resp.status_code != 200:
            print_result(False, "Failed to create test article")
            return False
        
        article_id = gen_resp.json()["id"]
        time.sleep(0.5)
        
        # Update article to have a title (so we can rewrite it)
        update_resp = session.put(f"{API_BASE}/articles/{article_id}", json={
            "title": "Test Title for Rewrite"
        })
        if update_resp.status_code != 200:
            print_result(False, "Failed to update article with title")
            return False
        
        resp = session.post(f"{API_BASE}/articles/{article_id}/rewrite", json={
            "target": "title",
            "operation": "regenerate"
        })
        print_response(resp)
        
        if resp.status_code == 502:
            data = resp.json()
            if "error" in data and "OPENAI_API_KEY" in data["error"]:
                print_result(True, "OPENAI_API_KEY placeholder detected, returns 502 with clear error")
                return True
            else:
                print_result(False, "502 but error message doesn't mention OPENAI_API_KEY")
                return False
        else:
            print_result(False, f"Expected 502, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 43: POST /api/articles/:id/rewrite - No content to rewrite
def test_article_rewrite_no_content():
    print_test("POST /api/articles/:id/rewrite - No content should return 400")
    try:
        # Create a test article (queued, no content yet)
        gen_resp = session.post(f"{API_BASE}/generate", json={
            "primaryKeyword": "test no content rewrite"
        })
        if gen_resp.status_code != 200:
            print_result(False, "Failed to create test article")
            return False
        
        article_id = gen_resp.json()["id"]
        time.sleep(0.5)
        
        # Try to rewrite a section that doesn't exist
        resp = session.post(f"{API_BASE}/articles/{article_id}/rewrite", json={
            "target": "section",
            "sectionIndex": 0,
            "operation": "readability"
        })
        print_response(resp)
        
        if resp.status_code == 400:
            data = resp.json()
            if "error" in data:
                print_result(True, "No content correctly returns 400")
                return True
            else:
                print_result(False, "400 but no error field")
                return False
        else:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 44: POST /api/articles/:id/retry - Non-existent article
def test_article_retry_not_found():
    print_test("POST /api/articles/:id/retry - Non-existent article should return 400")
    try:
        resp = session.post(f"{API_BASE}/articles/invalid-article-id-12345/retry")
        print_response(resp)
        
        if resp.status_code == 400:
            print_result(True, "Non-existent article correctly returns 400")
            return True
        else:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

# Test 45: POST /api/articles/:id/retry - Queued article
def test_article_retry_queued():
    print_test("POST /api/articles/:id/retry - Queued article should return 400")
    try:
        # Create a test article (will be queued)
        gen_resp = session.post(f"{API_BASE}/generate", json={
            "primaryKeyword": "test retry queued"
        })
        if gen_resp.status_code != 200:
            print_result(False, "Failed to create test article")
            return False
        
        article_id = gen_resp.json()["id"]
        time.sleep(0.5)
        
        resp = session.post(f"{API_BASE}/articles/{article_id}/retry")
        print_response(resp)
        
        if resp.status_code == 400:
            print_result(True, "Queued article correctly returns 400")
            return True
        else:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def main():
    print("\n" + "="*80)
    print("SEOForge AI Backend API Tests (v1 + v2)")
    print("="*80)
    
    results = []
    
    # v1 tests
    print("\n" + "="*80)
    print("v1 TESTS (Sanity Check)")
    print("="*80)
    results.append(("v1: Signup", test_signup()))
    results.append(("v1: Duplicate signup", test_duplicate_signup()))
    results.append(("v1: Short password", test_short_password()))
    results.append(("v1: NextAuth login", test_nextauth_login()))
    results.append(("v1: GET /api/me with auth", test_me_with_auth()))
    results.append(("v1: GET /api/me without auth", test_me_without_auth()))
    results.append(("v1: Dashboard stats", test_dashboard_stats()))
    results.append(("v1: SERP analyze", test_serp_analyze()))
    results.append(("v1: SERP analyze no keyword", test_serp_analyze_no_keyword()))
    results.append(("v1: Generate article", test_generate_article()))
    results.append(("v1: Generate no keyword", test_generate_no_keyword()))
    results.append(("v1: Bulk job", test_bulk_job()))
    results.append(("v1: Bulk empty rows", test_bulk_empty_rows()))
    results.append(("v1: List articles", test_list_articles()))
    results.append(("v1: List articles with filters", test_list_articles_with_filters()))
    results.append(("v1: Get article", test_get_article()))
    results.append(("v1: Get article not found", test_get_article_not_found()))
    results.append(("v1: Update article", test_update_article()))
    results.append(("v1: Export article", test_export_article()))
    results.append(("v1: Export not found", test_export_not_found()))
    results.append(("v1: Delete article", test_delete_article()))
    results.append(("v1: List jobs", test_list_jobs()))
    results.append(("v1: Get job", test_get_job()))
    results.append(("v1: Get job not found", test_get_job_not_found()))
    
    # v2 tests
    print("\n" + "="*80)
    print("v2 TESTS (New Features)")
    print("="*80)
    results.append(("v2: Create project", test_create_project()))
    results.append(("v2: Create project no name", test_create_project_no_name()))
    results.append(("v2: List projects", test_list_projects()))
    results.append(("v2: Get project", test_get_project()))
    results.append(("v2: Update project", test_update_project()))
    results.append(("v2: Generate with projectId", test_generate_with_project()))
    results.append(("v2: Bulk with projectId", test_bulk_with_project()))
    results.append(("v2: Articles filter by project", test_articles_filter_by_project()))
    results.append(("v2: Articles filter no project", test_articles_filter_no_project()))
    results.append(("v2: Articles group by website", test_articles_group_by_website()))
    results.append(("v2: Job pause", test_job_pause()))
    results.append(("v2: Job resume", test_job_resume()))
    results.append(("v2: Job retry-failed", test_job_retry_failed()))
    results.append(("v2: Job export no completed", test_job_export_no_completed()))
    results.append(("v2: Job export not found", test_job_export_not_found()))
    results.append(("v2: Article rewrite invalid target", test_article_rewrite_invalid_target()))
    results.append(("v2: Article rewrite not found", test_article_rewrite_not_found()))
    results.append(("v2: Article rewrite no OPENAI key", test_article_rewrite_no_openai_key()))
    results.append(("v2: Article rewrite no content", test_article_rewrite_no_content()))
    results.append(("v2: Article retry not found", test_article_retry_not_found()))
    results.append(("v2: Article retry queued", test_article_retry_queued()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed ({passed*100//total}%)")
    print("="*80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
