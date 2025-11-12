from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import io
from PIL import Image

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class RecognitionRequest(BaseModel):
    image_base64: str
    source: str  # 'canvas', 'upload', 'webcam'

class CompareRequest(BaseModel):
    predicted_text: str
    expected_text: str

class RecognitionResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recognized_text: str
    confidence: Optional[str] = None
    source: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    image_preview: Optional[str] = None

class CompareResult(BaseModel):
    match_percentage: float
    analysis: str

# Helper function to recognize handwriting
async def recognize_handwriting(image_base64: str) -> dict:
    try:
        # Initialize LLM Chat with OpenAI Vision
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are an expert in recognizing handwritten text including digits, letters, and symbols. Provide accurate transcriptions."
        ).with_model("openai", "gpt-4o")
        
        # Create image content
        image_content = ImageContent(image_base64=image_base64)
        
        # Create message
        message = UserMessage(
            text="Please carefully analyze this handwritten image and transcribe all visible digits, alphabets, and symbols. Return the result in this exact JSON format: {\"text\": \"transcribed content\", \"confidence\": \"high/medium/low\", \"details\": \"brief description of what you see\"}",
            file_contents=[image_content]
        )
        
        # Get response
        response = await chat.send_message(message)
        
        # Parse response
        import json
        try:
            # Try to extract JSON from response
            response_text = response.strip()
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0].strip()
            
            result = json.loads(response_text)
        except:
            # Fallback to plain text
            result = {
                "text": response,
                "confidence": "medium",
                "details": "Recognition completed"
            }
        
        return result
    except Exception as e:
        logger.error(f"Recognition error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Recognition failed: {str(e)}")

@api_router.get("/")
async def root():
    return {"message": "Handwriting Recognition API"}

@api_router.post("/recognize", response_model=RecognitionResult)
async def recognize_image(request: RecognitionRequest):
    try:
        # Recognize the handwriting
        result = await recognize_handwriting(request.image_base64)
        
        # Create result object
        recognition = RecognitionResult(
            recognized_text=result.get('text', ''),
            confidence=result.get('confidence', 'medium'),
            source=request.source,
            image_preview=request.image_base64[:100] + "..."  # Store preview
        )
        
        # Save to database
        doc = recognition.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.recognitions.insert_one(doc)
        
        return recognition
    except Exception as e:
        logger.error(f"Recognition endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/recognize/upload")
async def recognize_upload(file: UploadFile = File(...)):
    try:
        # Read and convert image to base64
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if too large
        max_size = (1024, 1024)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Convert to base64
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Recognize
        result = await recognize_handwriting(img_base64)
        
        # Create result object
        recognition = RecognitionResult(
            recognized_text=result.get('text', ''),
            confidence=result.get('confidence', 'medium'),
            source='upload',
            image_preview=img_base64[:100] + "..."
        )
        
        # Save to database
        doc = recognition.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.recognitions.insert_one(doc)
        
        return recognition
    except Exception as e:
        logger.error(f"Upload recognition error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/history", response_model=List[RecognitionResult])
async def get_history():
    try:
        history = await db.recognitions.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
        
        # Convert timestamps
        for item in history:
            if isinstance(item['timestamp'], str):
                item['timestamp'] = datetime.fromisoformat(item['timestamp'])
        
        return history
    except Exception as e:
        logger.error(f"History error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/compare", response_model=CompareResult)
async def compare_text(request: CompareRequest):
    try:
        # Simple comparison logic
        predicted = request.predicted_text.lower().strip()
        expected = request.expected_text.lower().strip()
        
        if predicted == expected:
            match_percentage = 100.0
            analysis = "Perfect match!"
        else:
            # Calculate similarity (simple approach)
            matches = sum(1 for a, b in zip(predicted, expected) if a == b)
            max_len = max(len(predicted), len(expected))
            match_percentage = (matches / max_len * 100) if max_len > 0 else 0
            
            analysis = f"Partial match. Predicted: '{request.predicted_text}' vs Expected: '{request.expected_text}'"
        
        return CompareResult(
            match_percentage=round(match_percentage, 2),
            analysis=analysis
        )
    except Exception as e:
        logger.error(f"Compare error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()