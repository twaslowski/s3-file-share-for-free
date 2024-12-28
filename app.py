import os
import logging
from flask import Flask, render_template, request, jsonify, send_file, Response, abort
from werkzeug.utils import secure_filename
from s3_utils import upload_file, download_file, list_files_and_folders, get_file_url, delete_file, create_folder, delete_folder
from config import S3_BUCKET
import mimetypes
import boto3
from botocore.exceptions import ClientError

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024 * 1024  # 1 TB

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

CHUNK_SIZE = 100 * 1024 * 1024  # 100 MB chunks

# Update MIME type detection
mimetypes.init()
mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('image/heic', '.heic')
mimetypes.add_type('image/heif', '.heif')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        filename = secure_filename(file.filename)
        folder = request.form.get('folder', '')
        if folder:
            filename = f"{folder.rstrip('/')}/{filename}"
        try:
            upload_file(file, filename)
            return jsonify({'message': 'File uploaded successfully'}), 200
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/upload_chunk', methods=['POST'])
def upload_chunk():
    try:
        chunk = request.files['chunk']
        filename = request.form['filename']
        file_size = int(request.form['file_size'])
        chunk_number = int(request.form['chunk_number'])
        total_chunks = int(request.form['total_chunks'])

        logger.info(f"Uploading chunk {chunk_number + 1} of {total_chunks} for file {filename}")

        s3 = boto3.client('s3')
        if file_size < CHUNK_SIZE:
            # Single-part upload for small files
            s3.upload_fileobj(chunk, S3_BUCKET, filename)
            logger.info(f"Single-part upload completed for file {filename}")
            return jsonify({'message': 'File uploaded successfully'}), 200
        else:
            # Multipart upload for larger files
            if chunk_number == 0:
                multipart_upload = s3.create_multipart_upload(Bucket=S3_BUCKET, Key=filename)
                upload_id = multipart_upload['UploadId']
                logger.info(f"Initialized multipart upload for {filename} with UploadId: {upload_id}")
            else:
                upload_id = request.form['upload_id']

            part = s3.upload_part(
                Bucket=S3_BUCKET,
                Key=filename,
                PartNumber=chunk_number + 1,
                UploadId=upload_id,
                Body=chunk
            )

            if chunk_number == total_chunks - 1:
                parts = []
                for i in range(total_chunks):
                    parts.append({
                        'ETag': s3.upload_part(
                            Bucket=S3_BUCKET,
                            Key=filename,
                            PartNumber=i + 1,
                            UploadId=upload_id,
                            Body=''
                        )['ETag'],
                        'PartNumber': i + 1
                    })

                s3.complete_multipart_upload(
                    Bucket=S3_BUCKET,
                    Key=filename,
                    UploadId=upload_id,
                    MultipartUpload={'Parts': parts}
                )
                logger.info(f"Completed multipart upload for {filename}")
                return jsonify({'message': 'File uploaded successfully'}), 200
            else:
                return jsonify({'upload_id': upload_id}), 200

    except Exception as e:
        logger.error(f"Error in upload_chunk: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/download/<path:filename>')
def download(filename):
    try:
        s3 = boto3.client('s3')
        file_obj = s3.get_object(Bucket=S3_BUCKET, Key=filename)
        file_size = file_obj['ContentLength']

        def generate():
            offset = 0
            while offset < file_size:
                chunk = min(CHUNK_SIZE, file_size - offset)
                byte_range = f'bytes={offset}-{offset + chunk - 1}'
                try:
                    response = s3.get_object(Bucket=S3_BUCKET, Key=filename, Range=byte_range)
                    data = response['Body'].read()
                    offset += len(data)
                    yield data
                except ClientError as e:
                    logger.error(f"Error downloading file chunk: {str(e)}")
                    abort(500)

        headers = {
            'Content-Disposition': f'attachment; filename="{os.path.basename(filename)}"',
            'Content-Length': str(file_size),
        }
        return Response(generate(), headers=headers, direct_passthrough=True)
    except ClientError as e:
        logger.error(f"Error initiating file download: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete/<path:filename>', methods=['DELETE'])
def delete(filename):
    try:
        delete_file(filename)
        return jsonify({'message': 'File deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/list')
def list_bucket_files():
    try:
        prefix = request.args.get('prefix', '')
        min_file_size = request.args.get('min_file_size', 0, type=int)
        files, folders = list_files_and_folders(prefix, min_file_size)
        file_data = []
        for file in files:
            mime_type, _ = mimetypes.guess_type(file['name'])
            preview_url = None
            if mime_type and (mime_type.startswith('image/') or mime_type == 'application/pdf' or mime_type.startswith('video/')):
                preview_url = get_file_url(file['name'])
            file_data.append({
                'name': file['name'],
                'size': file['size'],
                'preview_url': preview_url,
                'mime_type': mime_type,
                'type': 'file'
            })
        for folder in folders:
            file_data.append({
                'name': folder,
                'type': 'folder'
            })
        return jsonify({'files': file_data}), 200
    except Exception as e:
        logger.error(f"Error listing files and folders: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/create_folder', methods=['POST'])
def create_new_folder():
    folder_name = request.json.get('folder_name')
    if not folder_name:
        return jsonify({'error': 'Folder name is required'}), 400
    try:
        create_folder(folder_name)
        return jsonify({'message': 'Folder created successfully'}), 200
    except Exception as e:
        logger.error(f"Error creating folder: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete_folder/<path:folder_name>', methods=['DELETE'])
def remove_folder(folder_name):
    try:
        delete_folder(folder_name)
        return jsonify({'message': 'Folder deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Error deleting folder: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.errorhandler(500)
def internal_server_error(error):
    logger.error(f"Internal Server Error: {str(error)}")
    return jsonify({'error': 'Internal Server Error'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
