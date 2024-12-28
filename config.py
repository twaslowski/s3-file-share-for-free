import os

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', 'default_access_key')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', 'default_secret_key')
S3_BUCKET = os.environ.get('S3_BUCKET', 'default_bucket')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# Print a warning if using default values
if 'default_access_key' in (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET):
    print("Warning: Using default AWS credentials. Please set the correct environment variables.")
