from flask import Flask, render_template, request, jsonify, send_from_directory, Response
from openai import OpenAI
import os
from dotenv import load_dotenv
import logging
import json
from datetime import datetime
from urllib.request import urlretrieve
import uuid
from collections import Counter
import requests
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.logger.setLevel(logging.INFO)

# Constants
IMAGES_DIR = os.path.join('static', 'generated_images')
HISTORY_FILE = os.path.join(app.static_folder, 'image_history.json')
MAX_HISTORY = 12  # Maximum number of images to keep in history

# Ensure directories exist
os.makedirs(IMAGES_DIR, exist_ok=True)

# Initialize or load image history
def load_image_history():
    """Load the image history from JSON file."""
    try:
        with open(HISTORY_FILE, 'r') as f:
            data = json.load(f)
            return data.get('images', [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_image_history(url, prompt):
    """Save a new image to the history."""
    try:
        # Load existing data
        with open(HISTORY_FILE, 'r') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = {
            "metadata": {
                "app_name": "VisionForge",
                "version": "1.0",
                "last_updated": datetime.now().isoformat()
            },
            "categories": {
                "landscape": ["mountain", "forest", "lake", "sunset"],
                "urban": ["cyberpunk", "city", "futuristic"],
                "fantasy": ["magical", "fairy", "glowing"]
            },
            "images": [],
            "stats": {
                "total_images": 0,
                "total_categories": 3,
                "popular_tags": []
            }
        }
    
    # Determine category and tags based on prompt
    category = "other"
    tags = []
    prompt_lower = prompt.lower()
    
    if any(word in prompt_lower for word in ["mountain", "lake", "sunset", "landscape"]):
        category = "landscape"
        tags.extend([tag for tag in ["mountain", "lake", "sunset"] if tag in prompt_lower])
    elif any(word in prompt_lower for word in ["cyberpunk", "city", "futuristic"]):
        category = "urban"
        tags.extend([tag for tag in ["cyberpunk", "city", "futuristic"] if tag in prompt_lower])
    elif any(word in prompt_lower for word in ["magical", "fairy", "glowing"]):
        category = "fantasy"
        tags.extend([tag for tag in ["magical", "fairy", "glowing"] if tag in prompt_lower])
    
    # Create new image entry
    image_id = url.split('/')[-1].split('.')[0]
    new_image = {
        "id": image_id,
        "url": url,
        "prompt": prompt,
        "timestamp": datetime.now().isoformat(),
        "category": category,
        "tags": tags,
        "metadata": {
            "likes": 0,
            "downloads": 0
        }
    }
    
    # Add new image to the list
    data['images'].insert(0, new_image)
    
    # Update metadata and stats
    data['metadata']['last_updated'] = datetime.now().isoformat()
    data['stats']['total_images'] = len(data['images'])
    
    # Update popular tags
    all_tags = []
    for img in data['images']:
        all_tags.extend(img.get('tags', []))
    tag_counts = Counter(all_tags)
    data['stats']['popular_tags'] = [tag for tag, _ in tag_counts.most_common(3)]
    
    # Save updated data
    with open(HISTORY_FILE, 'w') as f:
        json.dump(data, f, indent=4)
    
    return data['images']

def save_image_locally(image_url):
    """Download and save image locally, return local path."""
    filename = f"{uuid.uuid4()}.png"
    local_path = os.path.join(IMAGES_DIR, filename)
    try:
        urlretrieve(image_url, local_path)
        return f"/static/generated_images/{filename}"
    except Exception as e:
        logger.error(f"Failed to save image locally: {e}")
        return image_url

# Initialize OpenAI client
client = OpenAI(
    api_key=os.getenv('OPENAI_API_KEY', "your_api_key_here"),
    base_url=os.getenv('OPENAI_BASE_URL', "server_url")
)

@app.route('/')
def index():
    """Render the main VisionForge interface."""
    history = load_image_history()
    return render_template('index.html', latest_images=history)

@app.route('/generate', methods=['POST'])
def generate_image():
    """Generate an image using the VisionForge AI."""
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            app.logger.error("No prompt provided in request")
            return jsonify({'error': 'No prompt provided'}), 400

        prompt = data['prompt']
        app.logger.info(f"Generating image for prompt: {prompt}")
        
        try:
            # Generate image using OpenAI
            app.logger.info("Sending request to OpenAI API")
            response = client.images.generate(
                model="flux-dev",
                prompt=prompt,
                size="1024x1024",
                n=1
            )
            
            app.logger.info("Received response from OpenAI API")
            image_url = response.data[0].url
            app.logger.info(f"Image URL received: {image_url}")
            
            # Save image information and get the latest images
            app.logger.info("Saving image to history")
            latest_images = save_image_history(image_url, prompt)
            
            # Get the ID of the newly generated image (it will be the first one)
            new_image_id = latest_images[0]['id'] if latest_images else None
            app.logger.info(f"New image ID: {new_image_id}")
            
            return jsonify({
                'success': True,
                'image_url': image_url,
                'image_id': new_image_id,
                'latest_images': latest_images
            })
            
        except Exception as e:
            app.logger.error(f"Error generating image: {str(e)}")
            return jsonify({'error': str(e)}), 500

    except Exception as e:
        app.logger.error(f"Error processing request: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/latest-images')
def get_latest():
    """Get the latest generated images with pagination."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 6  # Number of images per page
        
        with open(HISTORY_FILE, 'r') as f:
            history_data = json.load(f)
            
        images = history_data.get('images', [])
        total_images = len(images)
        total_pages = (total_images + per_page - 1) // per_page
        
        # Calculate start and end indices for the current page
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        
        # Get images for current page
        current_page_images = images[start_idx:end_idx]
        
        return jsonify({
            'success': True,
            'images': current_page_images,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'per_page': per_page,
                'total_images': total_images
            }
        })
        
    except Exception as e:
        app.logger.error(f"Error fetching latest images: {str(e)}")
        return jsonify({'error': 'Failed to fetch latest images'}), 500

@app.route('/like-image', methods=['POST'])
def like_image():
    """Handle image likes."""
    try:
        data = request.get_json()
        image_id = data.get('imageId')
        
        # Load current data
        with open(HISTORY_FILE, 'r') as f:
            history_data = json.load(f)
        
        # Find and update the image
        for image in history_data['images']:
            if image['id'] == image_id:
                image['metadata']['likes'] += 1
                likes = image['metadata']['likes']
                
                # Save updated data
                with open(HISTORY_FILE, 'w') as f:
                    json.dump(history_data, f, indent=4)
                
                return jsonify({'success': True, 'likes': likes})
        
        return jsonify({'success': False, 'error': 'Image not found'}), 404
    
    except Exception as e:
        app.logger.error(f"Error liking image: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/increment-downloads', methods=['POST'])
def increment_downloads():
    """Handle download count increments."""
    try:
        data = request.get_json()
        image_id = data.get('imageId')
        
        # Load current data
        with open(HISTORY_FILE, 'r') as f:
            history_data = json.load(f)
        
        # Find and update the image
        for image in history_data['images']:
            if image['id'] == image_id:
                image['metadata']['downloads'] += 1
                
                # Save updated data
                with open(HISTORY_FILE, 'w') as f:
                    json.dump(history_data, f, indent=4)
                
                return jsonify({'success': True})
        
        return jsonify({'success': False, 'error': 'Image not found'}), 404
    
    except Exception as e:
        app.logger.error(f"Error incrementing downloads: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/proxy-download/<path:image_id>')
def proxy_download(image_id):
    """Proxy endpoint to download images while handling CORS."""
    try:
        # Find the image URL from history
        with open(HISTORY_FILE, 'r') as f:
            history_data = json.load(f)
            
        image_url = None
        for image in history_data['images']:
            if image['id'] == image_id:
                image_url = image['url']
                break
        
        if not image_url:
            return jsonify({'error': 'Image not found'}), 404
            
        # Download the image
        response = requests.get(image_url, stream=True)
        if not response.ok:
            return jsonify({'error': 'Failed to download image'}), 500
            
        # Get original filename or create one
        filename = f"visionforge-{image_id}.png"
        
        # Return the file with proper headers
        return Response(
            response.iter_content(chunk_size=8192),
            content_type=response.headers.get('content-type', 'image/png'),
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Allow-Origin": "*"
            }
        )
        
    except Exception as e:
        app.logger.error(f"Error downloading image: {str(e)}")
        return jsonify({'error': 'Failed to download image'}), 500

@app.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors."""
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Ensure the static and templates directories exist
    os.makedirs('static', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
