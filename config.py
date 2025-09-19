import json
import logging
import os
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class S3Config:
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    s3_bucket: str = ""
    aws_region: str = "us-east-1"

    def is_configured(self) -> bool:
        """Check if all required S3 settings are configured"""
        return bool(
            self.aws_access_key_id and self.aws_secret_access_key and self.s3_bucket
        )

    def save_to_file(self, filename: str = "s3_config.json") -> None:
        """Save configuration to a file"""
        try:
            with open(filename, "w") as f:
                json.dump(
                    {
                        "aws_access_key_id": self.aws_access_key_id,
                        "aws_secret_access_key": self.aws_secret_access_key,
                        "s3_bucket": self.s3_bucket,
                        "aws_region": self.aws_region,
                    },
                    f,
                )
            logger.info("Configuration saved successfully")
        except Exception as e:
            logger.error(f"Error saving configuration: {str(e)}")
            raise

    def load_from_file(self, filename: str = "s3_config.json") -> bool:
        """Load configuration from a file. Returns True if file was loaded."""
        try:
            if os.path.exists(filename):
                with open(filename, "r") as f:
                    config = json.load(f)
                self.aws_access_key_id = config.get("aws_access_key_id", "")
                self.aws_secret_access_key = config.get("aws_secret_access_key", "")
                self.s3_bucket = config.get("s3_bucket", "")
                self.aws_region = config.get("aws_region", "us-east-1")
                logger.info("Configuration loaded successfully from file")
                return True
            else:
                logger.warning("No configuration file found")
                return False
        except Exception as e:
            logger.error(f"Error loading configuration file: {str(e)}")
            return False

    def load_from_env(self) -> bool:
        """Load configuration from environment variables. Returns True if any were set.
        Supported vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET
        """
        access_key = os.environ.get("AWS_ACCESS_KEY_ID", "")
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
        bucket = os.environ.get("S3_BUCKET", "")
        region = os.environ.get("AWS_REGION", self.aws_region or "us-east-1")

        any_set = any([access_key, secret_key, bucket])
        if any_set:
            # Only overwrite with non-empty values to allow partial env config
            if access_key:
                self.aws_access_key_id = access_key
            if secret_key:
                self.aws_secret_access_key = secret_key
            if bucket:
                self.s3_bucket = bucket
            self.aws_region = region or self.aws_region or "us-east-1"
            logger.info("Configuration loaded from environment variables")
        else:
            logger.info("No S3-related environment variables found to load")
        return any_set

    def update(
        self, access_key: str, secret_key: str, bucket: str, region: str = "us-east-1"
    ) -> None:
        """Update configuration with new values"""
        self.aws_access_key_id = access_key
        self.aws_secret_access_key = secret_key
        self.s3_bucket = bucket
        self.aws_region = region
        self.save_to_file()  # Save changes to file


# Create a global instance
s3_config = S3Config()

# Try to load existing configuration from file, then fall back to environment
try:
    loaded = s3_config.load_from_file()
    if not loaded:
        s3_config.load_from_env()
except Exception as e:
    logger.error(f"Error initializing S3 configuration: {str(e)}")
    # Best effort: attempt env load even if file load raised
    try:
        s3_config.load_from_env()
    except Exception as env_err:
        logger.error(f"Error loading S3 configuration from env: {str(env_err)}")
