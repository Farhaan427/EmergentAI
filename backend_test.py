import requests
import sys
import base64
import io
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

class HandwritingAPITester:
    def __init__(self, base_url="https://sketch-reader.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def create_test_image_base64(self, text="Hello 123"):
        """Create a simple test image with text"""
        try:
            # Create a white image
            img = Image.new('RGB', (400, 200), color='white')
            draw = ImageDraw.Draw(img)
            
            # Try to use a font, fallback to default if not available
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
            except:
                font = ImageFont.load_default()
            
            # Draw text
            draw.text((50, 80), text, fill='black', font=font)
            
            # Convert to base64
            buffered = io.BytesIO()
            img.save(buffered, format="JPEG")
            img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
            return img_base64
        except Exception as e:
            print(f"Error creating test image: {e}")
            return None

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Response: {data}"
            self.log_test("Root Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("Root Endpoint", False, str(e))
            return False

    def test_recognize_endpoint(self):
        """Test the recognition endpoint with base64 image"""
        try:
            # Create test image
            test_image = self.create_test_image_base64("Test 123")
            if not test_image:
                self.log_test("Recognize Endpoint", False, "Could not create test image")
                return False

            # Test recognition
            payload = {
                "image_base64": test_image,
                "source": "canvas"
            }
            
            response = requests.post(
                f"{self.base_url}/recognize", 
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30  # Longer timeout for AI processing
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                required_fields = ['id', 'recognized_text', 'confidence', 'source', 'timestamp']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details += f", Missing fields: {missing_fields}"
                else:
                    details += f", Text: '{data['recognized_text']}', Confidence: {data['confidence']}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test("Recognize Endpoint", success, details)
            return success, response.json() if success else None
            
        except Exception as e:
            self.log_test("Recognize Endpoint", False, str(e))
            return False, None

    def test_upload_endpoint(self):
        """Test the file upload recognition endpoint"""
        try:
            # Create test image file
            img = Image.new('RGB', (400, 200), color='white')
            draw = ImageDraw.Draw(img)
            
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
            except:
                font = ImageFont.load_default()
            
            draw.text((50, 80), "Upload Test", fill='black', font=font)
            
            # Save to bytes
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='JPEG')
            img_bytes.seek(0)
            
            # Upload file
            files = {'file': ('test.jpg', img_bytes, 'image/jpeg')}
            response = requests.post(
                f"{self.base_url}/recognize/upload",
                files=files,
                timeout=30
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", Text: '{data['recognized_text']}', Source: {data['source']}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test("Upload Endpoint", success, details)
            return success
            
        except Exception as e:
            self.log_test("Upload Endpoint", False, str(e))
            return False

    def test_history_endpoint(self):
        """Test the history endpoint"""
        try:
            response = requests.get(f"{self.base_url}/history", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", History items: {len(data)}"
                if len(data) > 0:
                    # Check first item structure
                    first_item = data[0]
                    required_fields = ['id', 'recognized_text', 'source', 'timestamp']
                    missing_fields = [field for field in required_fields if field not in first_item]
                    if missing_fields:
                        success = False
                        details += f", Missing fields in history item: {missing_fields}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test("History Endpoint", success, details)
            return success
            
        except Exception as e:
            self.log_test("History Endpoint", False, str(e))
            return False

    def test_compare_endpoint(self):
        """Test the text comparison endpoint"""
        try:
            # Test exact match
            payload = {
                "predicted_text": "Hello World",
                "expected_text": "Hello World"
            }
            
            response = requests.post(
                f"{self.base_url}/compare",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                required_fields = ['match_percentage', 'analysis']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details += f", Missing fields: {missing_fields}"
                else:
                    details += f", Match: {data['match_percentage']}%, Analysis: {data['analysis'][:50]}..."
                    # For exact match, should be 100%
                    if data['match_percentage'] != 100.0:
                        success = False
                        details += " (Expected 100% match for identical text)"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test("Compare Endpoint (Exact Match)", success, details)
            
            # Test partial match
            payload2 = {
                "predicted_text": "Hello World",
                "expected_text": "Hello Earth"
            }
            
            response2 = requests.post(
                f"{self.base_url}/compare",
                json=payload2,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            success2 = response2.status_code == 200
            details2 = f"Status: {response2.status_code}"
            
            if success2:
                data2 = response2.json()
                details2 += f", Match: {data2['match_percentage']}%"
                # Should be less than 100% for different text
                if data2['match_percentage'] >= 100.0:
                    success2 = False
                    details2 += " (Expected <100% match for different text)"
            
            self.log_test("Compare Endpoint (Partial Match)", success2, details2)
            
            return success and success2
            
        except Exception as e:
            self.log_test("Compare Endpoint", False, str(e))
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print(f"\n🚀 Starting Backend API Tests for {self.base_url}")
        print("=" * 60)
        
        # Test basic connectivity first
        if not self.test_root_endpoint():
            print("\n❌ Root endpoint failed - API may be down")
            return False
        
        # Test recognition functionality
        recognition_success, recognition_result = self.test_recognize_endpoint()
        
        # Test upload functionality
        self.test_upload_endpoint()
        
        # Test history (should have data after recognition tests)
        self.test_history_endpoint()
        
        # Test comparison
        self.test_compare_endpoint()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Backend Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
            return True
        else:
            print("⚠️  Some backend tests failed")
            failed_tests = [result for result in self.test_results if not result['success']]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
            return False

def main():
    tester = HandwritingAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())