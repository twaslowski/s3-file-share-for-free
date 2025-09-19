import logging
import os

from app import app
from config import s3_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_aws_credentials():
    if (
        not s3_config.aws_access_key_id
        or not s3_config.aws_secret_access_key
        or not s3_config.s3_bucket
    ):
        logger.info(
            "Warning: AWS credentials not set. Please configure them through the web interface."
        )
    else:
        logger.info("AWS credentials are set.")


if __name__ == "__main__":
    check_aws_credentials()
    # Check if we're in production environment
    is_production = os.environ.get("PRODUCTION", "false").lower() == "true"

    if is_production:
        # Production settings
        app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)), debug=False)
    else:
        # Development settings
        app.run(host="0.0.0.0", port=5001, debug=True)
