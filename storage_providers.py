from abc import ABC, abstractmethod
import boto3
import b2sdk.v2 as b2
import requests
from typing import BinaryIO, List, Tuple, Optional
import os
from google.cloud import storage
from google.oauth2 import service_account
import json
import io
import datetime

class StorageProvider(ABC):
    """Abstract base class for storage providers"""
    @abstractmethod
    def upload_file(self, file_obj: BinaryIO, filename: str) -> None:
        pass

    @abstractmethod
    def download_file(self, filename: str) -> BinaryIO:
        pass

    @abstractmethod
    def delete_file(self, filename: str) -> None:
        pass

    @abstractmethod
    def list_files(self, prefix: str = "") -> List[dict]:
        pass

    @abstractmethod
    def get_file_url(self, filename: str, expires_in: int = 3600) -> str:
        pass

class AWSS3Provider(StorageProvider):
    """Amazon S3 storage provider
    Authentication:
    - AWS Access Key ID
    - AWS Secret Access Key
    - Bucket Name
    - Region
    """
    def __init__(self, access_key: str, secret_key: str, bucket: str, region: str):
        self.client = boto3.client(
            's3',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        self.bucket = bucket

    def upload_file(self, file_obj: BinaryIO, filename: str) -> None:
        self.client.upload_fileobj(file_obj, self.bucket, filename)

    def download_file(self, filename: str) -> BinaryIO:
        response = self.client.get_object(Bucket=self.bucket, Key=filename)
        return response['Body']

    def delete_file(self, filename: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=filename)

    def list_files(self, prefix: str = "") -> List[dict]:
        response = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        return [{'name': obj['Key'], 'size': obj['Size']} for obj in response.get('Contents', [])]

    def get_file_url(self, filename: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': filename},
            ExpiresIn=expires_in
        )

class BackblazeB2Provider(StorageProvider):
    """Backblaze B2 storage provider
    Authentication:
    - Application Key ID (different from AWS)
    - Application Key
    - Bucket Name
    No region needed
    """
    def __init__(self, application_key_id: str, application_key: str, bucket_name: str):
        self.info = b2.InMemoryAccountInfo()
        self.b2_api = b2.B2Api(self.info)
        self.b2_api.authorize_account("production", application_key_id, application_key)
        self.bucket = self.b2_api.get_bucket_by_name(bucket_name)

    def upload_file(self, file_obj: BinaryIO, filename: str) -> None:
        self.bucket.upload_stream(file_obj, filename)

    def download_file(self, filename: str) -> BinaryIO:
        download_dest = b2.DownloadDestBytes()
        self.bucket.download_file_by_name(filename, download_dest)
        return io.BytesIO(download_dest.get_bytes_written())

    def delete_file(self, filename: str) -> None:
        file_version = self.bucket.get_file_info_by_name(filename)
        self.bucket.delete_file_version(file_version.id_, filename)

    def list_files(self, prefix: str = "") -> List[dict]:
        return [{'name': f.file_name, 'size': f.size} 
                for f in self.bucket.list_file_names(prefix)]

    def get_file_url(self, filename: str, expires_in: int = 3600) -> str:
        return self.bucket.get_download_authorization(
            filename,
            valid_duration_in_seconds=expires_in
        )

class WasabiProvider(StorageProvider):
    """Wasabi storage provider (S3 compatible)
    Authentication:
    - Access Key
    - Secret Key
    - Bucket Name
    - Region (Wasabi specific regions)
    """
    def __init__(self, access_key: str, secret_key: str, bucket: str, region: str):
        self.client = boto3.client(
            's3',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            endpoint_url=f'https://s3.{region}.wasabisys.com'
        )
        self.bucket = bucket

    def upload_file(self, file_obj: BinaryIO, filename: str) -> None:
        self.client.upload_fileobj(file_obj, self.bucket, filename)

    def download_file(self, filename: str) -> BinaryIO:
        response = self.client.get_object(Bucket=self.bucket, Key=filename)
        return response['Body']

    def delete_file(self, filename: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=filename)

    def list_files(self, prefix: str = "") -> List[dict]:
        response = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        return [{'name': obj['Key'], 'size': obj['Size']} for obj in response.get('Contents', [])]

    def get_file_url(self, filename: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': filename},
            ExpiresIn=expires_in
        )

class GoogleCloudStorageProvider(StorageProvider):
    """Google Cloud Storage provider
    Authentication:
    - Project ID
    - Service Account JSON (contains all auth info)
    - Bucket Name
    No region needed - handled by GCS
    """
    def __init__(self, project_id: str, bucket_name: str, credentials_json: str):
        try:
            # Parse the credentials JSON string into a dictionary
            if isinstance(credentials_json, str):
                try:
                    credentials_dict = json.loads(credentials_json)
                    print(f"Successfully parsed credentials JSON for project: {credentials_dict.get('project_id')}")
                except json.JSONDecodeError as e:
                    print(f"JSON parsing error: {str(e)}")
                    raise ValueError(f"Invalid service account JSON format: {str(e)}")
            else:
                credentials_dict = credentials_json

            try:
                credentials = service_account.Credentials.from_service_account_info(credentials_dict)
                print(f"Successfully created credentials for service account: {credentials_dict.get('client_email')}")
            except Exception as e:
                print(f"Error creating credentials: {str(e)}")
                raise ValueError(f"Error creating service account credentials: {str(e)}")

            try:
                self.client = storage.Client(project=project_id, credentials=credentials)
                print(f"Successfully created storage client for project: {project_id}")
            except Exception as e:
                print(f"Error creating storage client: {str(e)}")
                raise ValueError(f"Error creating storage client: {str(e)}")

            try:
                self.bucket = self.client.bucket(bucket_name)
                print(f"Successfully got bucket reference: {bucket_name}")
            except Exception as e:
                print(f"Error getting bucket: {str(e)}")
                raise ValueError(f"Error accessing bucket {bucket_name}: {str(e)}")

        except Exception as e:
            print(f"Unexpected error in GCS initialization: {str(e)}")
            raise ValueError(f"Error initializing Google Cloud Storage: {str(e)}")

    def list_files(self, prefix: str = "") -> List[dict]:
        try:
            blobs = self.bucket.list_blobs(prefix=prefix)
            return [{'name': blob.name, 'size': blob.size} for blob in blobs]
        except Exception as e:
            print(f"Error listing files: {str(e)}")
            raise ValueError(f"Error listing files: {str(e)}")

    def upload_file(self, file_obj: BinaryIO, filename: str) -> None:
        try:
            blob = self.bucket.blob(filename)
            blob.upload_from_file(file_obj)
        except Exception as e:
            print(f"Error uploading file: {str(e)}")
            raise ValueError(f"Error uploading file: {str(e)}")

    def download_file(self, filename: str) -> BinaryIO:
        try:
            blob = self.bucket.blob(filename)
            file_obj = io.BytesIO()
            blob.download_to_file(file_obj)
            file_obj.seek(0)
            return file_obj
        except Exception as e:
            print(f"Error downloading file: {str(e)}")
            raise ValueError(f"Error downloading file: {str(e)}")

    def delete_file(self, filename: str) -> None:
        try:
            blob = self.bucket.blob(filename)
            blob.delete()
        except Exception as e:
            print(f"Error deleting file: {str(e)}")
            raise ValueError(f"Error deleting file: {str(e)}")

    def get_file_url(self, filename: str, expires_in: int = 3600) -> str:
        try:
            blob = self.bucket.blob(filename)
            return blob.generate_signed_url(expiration=datetime.timedelta(seconds=expires_in))
        except Exception as e:
            print(f"Error generating signed URL: {str(e)}")
            raise ValueError(f"Error generating signed URL: {str(e)}")

class DigitalOceanSpacesProvider(StorageProvider):
    """DigitalOcean Spaces provider (S3 compatible)
    Authentication:
    - Spaces Access Key
    - Spaces Secret Key
    - Bucket Name
    - Region (DO specific: nyc3, ams3, sgp1, etc.)
    """
    def __init__(self, access_key: str, secret_key: str, bucket: str, region: str):
        self.client = boto3.client(
            's3',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            endpoint_url=f'https://{region}.digitaloceanspaces.com'
        )
        self.bucket = bucket

    def upload_file(self, file_obj: BinaryIO, filename: str) -> None:
        self.client.upload_fileobj(file_obj, self.bucket, filename)

    def download_file(self, filename: str) -> BinaryIO:
        response = self.client.get_object(Bucket=self.bucket, Key=filename)
        return response['Body']

    def delete_file(self, filename: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=filename)

    def list_files(self, prefix: str = "") -> List[dict]:
        response = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        return [{'name': obj['Key'], 'size': obj['Size']} for obj in response.get('Contents', [])]

    def get_file_url(self, filename: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': filename},
            ExpiresIn=expires_in
        )

class CloudflareR2Provider(StorageProvider):
    """Cloudflare R2 provider (S3 compatible)
    Authentication:
    - Account ID (Cloudflare specific)
    - Access Key ID
    - Secret Access Key
    - Bucket Name
    No region needed - uses 'auto'
    """
    def __init__(self, account_id: str, access_key: str, secret_key: str, bucket: str):
        self.client = boto3.client(
            's3',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
            region_name='auto'
        )
        self.bucket = bucket

    def upload_file(self, file_obj: BinaryIO, filename: str) -> None:
        self.client.upload_fileobj(file_obj, self.bucket, filename)

    def download_file(self, filename: str) -> BinaryIO:
        response = self.client.get_object(Bucket=self.bucket, Key=filename)
        return response['Body']

    def delete_file(self, filename: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=filename)

    def list_files(self, prefix: str = "") -> List[dict]:
        response = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        return [{'name': obj['Key'], 'size': obj['Size']} for obj in response.get('Contents', [])]

    def get_file_url(self, filename: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': filename},
            ExpiresIn=expires_in
        )

class HetznerStorageProvider(StorageProvider):
    """Hetzner Storage Box provider (S3 compatible)
    Authentication:
    - Access Key
    - Secret Key
    - Bucket Name
    - Region (Hetzner specific regions)
    """
    def __init__(self, access_key: str, secret_key: str, bucket: str, region: str = "eu-central-1"):
        self.client = boto3.client(
            's3',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            endpoint_url=f'https://s3.{region}.hetzner.cloud',
            region_name=region
        )
        self.bucket = bucket

    def upload_file(self, file_obj: BinaryIO, filename: str) -> None:
        self.client.upload_fileobj(file_obj, self.bucket, filename)

    def download_file(self, filename: str) -> BinaryIO:
        response = self.client.get_object(Bucket=self.bucket, Key=filename)
        return response['Body']

    def delete_file(self, filename: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=filename)

    def list_files(self, prefix: str = "") -> List[dict]:
        response = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        return [{'name': obj['Key'], 'size': obj['Size']} for obj in response.get('Contents', [])]

    def get_file_url(self, filename: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': filename},
            ExpiresIn=expires_in
        )

def get_storage_provider(provider_type: str, **credentials) -> StorageProvider:
    """Factory function to create storage provider instances
    
    Each provider has different authentication requirements:
    - AWS S3: access_key, secret_key, bucket, region
    - Backblaze B2: application_key_id, application_key, bucket_name
    - Google Cloud: project_id, bucket_name, credentials_json
    - Cloudflare R2: account_id, access_key, secret_key, bucket
    - DigitalOcean: access_key, secret_key, bucket, region
    - Wasabi: access_key, secret_key, bucket, region
    - Hetzner: access_key, secret_key, bucket, region
    """
    providers = {
        'aws': AWSS3Provider,
        'backblaze': BackblazeB2Provider,
        'wasabi': WasabiProvider,
        'gcs': GoogleCloudStorageProvider,
        'digitalocean': DigitalOceanSpacesProvider,
        'cloudflare': CloudflareR2Provider,
        'hetzner': HetznerStorageProvider,
    }
    
    if provider_type not in providers:
        raise ValueError(f"Unsupported storage provider: {provider_type}")
        
    return providers[provider_type](**credentials) 