from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import json
import tempfile
import os
from typing import Dict
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from google.cloud import logging as cloud_logging, firestore
from firebase_admin import credentials as firebase_cred, storage
import firebase_admin
import logging
from langchain_anthropic import ChatAnthropic
from langchain.tools import StructuredTool
import base64

# Environment variables
PROJECT = os.getenv('PROJECT')
BASE_API_URL = os.getenv('BASE_API_URL')
SERVICE_ACCOUNT_CREDS = json.loads(os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'))
STORAGE_BUCKET = os.getenv('STORAGE_BUCKET')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
FRONTEND_URL = os.getenv('FRONTEND_URL')

app = Flask(__name__, static_folder='static')
CORS(app)

# Initialize services
credentials = Credentials.from_service_account_info(SERVICE_ACCOUNT_CREDS)
db = firestore.Client(credentials=credentials)
cred = firebase_cred.Certificate(SERVICE_ACCOUNT_CREDS)
firebase_admin.initialize_app(cred)
cloud_logging.Client(credentials=credentials).setup_logging()

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Google Sheets API setup
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

#LLM
chat = ChatAnthropic(
    anthropic_api_key=ANTHROPIC_API_KEY,
    model="claude-3-sonnet-20240229"
)


def image_to_text(image_content: bytes) -> Dict[str, str]:
    """
    Analyzes a screenshot and returns structured activity information.
    
    Args:
        image_content: The screenshot in bytes format
    
    Returns:
        Dict containing activity, application and category
    """
    tools = [
        {
            "type": "function",
            "function": {
                "name": "analyze_activity",
                "description": "Analyzes a screenshot to determine the user's activity",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "activity": {
                            "type": "string",
                            "description": "Short description of the main activity (max 10 words, start with verb)"
                        },
                        "application": {
                            "type": "string",
                            "description": "Name of the application being used"
                        },
                        "category": {
                            "type": "string",
                            "description": "Type of activity (programming/writing/admin/email/meeting/other)",
                            "enum": ["programming", "writing", "admin", "email", "meeting", "other"]
                        }
                    },
                    "required": ["activity", "application", "category"]
                }
            }
        }
    ]

    messages = [
        {
            "role": "system",
            "content": """Je bent een assistent die screenshots analyseert voor tijdregistratie. 
            Gebruik de analyze_activity functie om te beschrijven wat je ziet."""
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Wat gebeurt er in deze screenshot?"
                },
                {
                    "type": "image",
                    "image_bytes": base64.b64encode(image_content).decode()
                }
            ]
        }
    ]

    response = chat.invoke(
        messages=messages,
        tools=tools,
        tool_choice={"type": "function", "function": {"name": "analyze_activity"}}
    )

    # Extract the function call response
    try:
        tool_response = response.content[0]
        if tool_response.get("type") == "function":
            return tool_response["function"]["arguments"]
        else:
            return {
                "activity": "Kon activiteit niet analyseren",
                "application": "onbekend",
                "category": "other"
            }
    except Exception as e:
        print(f"Error processing response: {e}")
        return {
            "activity": "Error bij analyse",
            "application": "onbekend",
            "category": "other"
        }

# Registreer de tool in Langchain
screenshot_tool = StructuredTool.from_function(
    func=image_to_text,
    name="image_to_text",
    description="Analyzes a screenshot to determine the user's activity"
)

@app.route('/upload', methods=['POST'])
@cross_origin()
def upload_screenshot():
    if 'screenshot' not in request.files:
        return jsonify({'error': 'No screenshot provided'}), 400
    
    user_id = request.form.get('userId')
    if not user_id:
        return jsonify({'error': 'No user ID provided'}), 400

    screenshot = request.files['screenshot']
    
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        screenshot.save(temp_file.name)
        
        # Upload naar Cloud Storage
        bucket = storage.bucket()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        blob_name = f'screenshots/{user_id}/{timestamp}.png'
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(temp_file.name)
        
        # Analyze with Claude
        with open(temp_file.name, 'rb') as image_file:
            content = image_file.read()
            activity_description = image_to_text(content)
        
        # Update timesheet
        update_timesheet(user_id, activity_description)
        
        # Cleanup
        os.unlink(temp_file.name)
        
        # Schedule deletion after 30 minutes
        schedule_deletion(blob_name)
        
        return jsonify({
            'success': True,
            'activity': activity_description
        })

def update_timesheet(user_id, activity):
    try:
        # Get user's spreadsheet ID from Firestore
        doc_ref = db.collection('users').document(user_id)
        user_doc = doc_ref.get()
        
        if not user_doc.exists:
            logger.error(f"No spreadsheet found for user {user_id}")
            return
            
        spreadsheet_id = user_doc.get('spreadsheet_id')
        
        service = build('sheets', 'v4', credentials=credentials)
        
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        values = [[timestamp, activity]]
        
        body = {
            'values': values
        }
        
        service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range='Sheet1!A:B',
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
        
    except Exception as e:
        logger.error(f"Error updating timesheet: {e}")

def schedule_deletion(blob_name):
    # TODO: Implement Cloud Scheduler job for deletion
    # For now, we'll just log it
    logger.info(f"Scheduled deletion for {blob_name}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))