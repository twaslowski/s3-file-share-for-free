import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET, AWS_REGION
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_s3_client():
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
        return s3_client
    except NoCredentialsError:
        logger.error("AWS credentials not found or invalid.")
        raise Exception("AWS credentials not found or invalid.")
    except Exception as e:
        logger.error(f"Error creating S3 client: {str(e)}")
        raise Exception(f"Error creating S3 client: {str(e)}")

def upload_file(file_obj, filename):
    """Upload a file to S3 bucket"""
    try:
        s3_client = get_s3_client()
        s3_client.upload_fileobj(file_obj, S3_BUCKET, filename)
        logger.info(f"File {filename} uploaded successfully.")
    except ClientError as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise Exception(f"Error uploading file: {str(e)}")

def download_file(filename):
    """Generate a pre-signed URL for downloading a file"""
    try:
        s3_client = get_s3_client()
        response = s3_client.generate_presigned_url('get_object',
                                                    Params={'Bucket': S3_BUCKET,
                                                            'Key': filename},
                                                    ExpiresIn=3600)
        logger.info(f"Download URL generated for file {filename}.")
        return response
    except ClientError as e:
        logger.error(f"Error generating download URL: {str(e)}")
        raise Exception(f"Error generating download URL: {str(e)}")

def list_files_and_folders(prefix='', min_file_size=0):
    """List all files and folders in the S3 bucket"""
    try:
        s3_client = get_s3_client()
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=S3_BUCKET, Delimiter='/', Prefix=prefix)
        
        files = []
        folders = []

        for page in pages:
            for content in page.get('Contents', []):
                if content['Key'] != prefix:
                    if content['Size'] >= min_file_size:
                        files.append({'name': content['Key'], 'size': content['Size']})
            
            for common_prefix in page.get('CommonPrefixes', []):
                folders.append(common_prefix['Prefix'])

        logger.info(f"Successfully listed files and folders from the S3 bucket with prefix: {prefix}")
        return files, folders
    except ClientError as e:
        logger.error(f"Error listing files and folders: {str(e)}")
        raise Exception(f"Error listing files and folders: {str(e)}")

def get_file_url(filename):
    """Generate a pre-signed URL for file preview"""
    try:
        s3_client = get_s3_client()
        response = s3_client.generate_presigned_url('get_object',
                                                    Params={'Bucket': S3_BUCKET,
                                                            'Key': filename},
                                                    ExpiresIn=3600)
        logger.info(f"Preview URL generated for file {filename}.")
        return response
    except ClientError as e:
        logger.error(f"Error generating preview URL: {str(e)}")
        raise Exception(f"Error generating preview URL: {str(e)}")

def delete_file(filename):
    """Delete a file from the S3 bucket"""
    try:
        s3_client = get_s3_client()
        s3_client.delete_object(Bucket=S3_BUCKET, Key=filename)
        logger.info(f"File {filename} deleted successfully.")
    except ClientError as e:
        logger.error(f"Error deleting file: {str(e)}")
        raise Exception(f"Error deleting file: {str(e)}")

def create_folder(folder_name):
    """Create a new folder in the S3 bucket"""
    try:
        s3_client = get_s3_client()
        folder_name = folder_name.rstrip('/') + '/'
        s3_client.put_object(Bucket=S3_BUCKET, Key=folder_name)
        logger.info(f"Folder {folder_name} created successfully.")
    except ClientError as e:
        logger.error(f"Error creating folder: {str(e)}")
        raise Exception(f"Error creating folder: {str(e)}")

def delete_folder(folder_name):
    """Delete a folder and its contents from the S3 bucket"""
    try:
        s3_client = get_s3_client()
        folder_name = folder_name.rstrip('/') + '/'
        
        # List all objects within the folder
        response = s3_client.list_objects_v2(Bucket=S3_BUCKET, Prefix=folder_name)
        
        # Delete all objects within the folder
        for obj in response.get('Contents', []):
            s3_client.delete_object(Bucket=S3_BUCKET, Key=obj['Key'])
        
        # Delete the folder itself
        s3_client.delete_object(Bucket=S3_BUCKET, Key=folder_name)
        
        logger.info(f"Folder {folder_name} and its contents deleted successfully.")
    except ClientError as e:
        logger.error(f"Error deleting folder: {str(e)}")
        raise Exception(f"Error deleting folder: {str(e)}")
