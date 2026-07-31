import json
import os
from urllib.parse import quote_plus

import boto3
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def resolve_database_url():
    """Prefer DATABASE_URL; otherwise load JSON secret from Secrets Manager."""
    direct = os.environ.get("DATABASE_URL", "").strip()
    if direct:
        return direct

    secret_arn = os.environ.get("DB_SECRET_ARN", "").strip()
    if not secret_arn:
        raise RuntimeError("Set DATABASE_URL or DB_SECRET_ARN")

    region = (
        os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or "us-east-1"
    )
    client = boto3.client("secretsmanager", region_name=region)
    payload = json.loads(client.get_secret_value(SecretId=secret_arn)["SecretString"])
    user = quote_plus(payload["username"])
    password = quote_plus(payload["password"])
    host = payload["host"]
    port = payload.get("port", 5432)
    dbname = payload.get("dbname", "attendance")
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{dbname}"
