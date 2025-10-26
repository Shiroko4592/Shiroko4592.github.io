from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests

app = Flask(__name__, static_folder='.')
CORS(app)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/naver/profile', methods=['GET'])
def get_naver_profile():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({'error': 'No authorization header', 'auth_failed': True}), 401
    
    try:
        response = requests.get(
            'https://openapi.naver.com/v1/nid/me',
            headers={'Authorization': auth_header},
            timeout=10
        )
        
        data = response.json()
        
        if response.status_code == 401:
            return jsonify({'error': 'Invalid or expired token', 'auth_failed': True, 'resultcode': 'auth_error'}), 401
        elif response.status_code != 200:
            return jsonify({'error': f'Naver API error: {response.status_code}', 'auth_failed': False, 'resultcode': 'api_error'}), response.status_code
        
        resultcode = data.get('resultcode', '')
        if resultcode == '00':
            return jsonify(data)
        else:
            auth_error_codes = ['024', '028', '403']
            is_auth_error = resultcode in auth_error_codes
            error_msg = data.get('message', f'Naver API error: {resultcode}')
            return jsonify({
                'error': error_msg,
                'auth_failed': is_auth_error,
                'resultcode': resultcode,
                'message': error_msg
            }), 401 if is_auth_error else 500
            
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timeout', 'auth_failed': False, 'resultcode': 'timeout'}), 504
    except Exception as e:
        return jsonify({'error': str(e), 'auth_failed': False, 'resultcode': 'unknown_error'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
