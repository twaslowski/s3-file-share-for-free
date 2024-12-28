from app import app
from config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET

def check_aws_credentials():
    if 'default_access_key' in (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET):
        print("Warning: Using default AWS credentials. The application may not function correctly.")
        print("Please set the correct AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET environment variables.")
    else:
        print("AWS credentials are set.")

if __name__ == "__main__":
    check_aws_credentials()
    app.run(host="0.0.0.0", port=5001, debug=True)
