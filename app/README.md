# Daymark attendance app

Flask + PostgreSQL attendance desk used by the Terraform EC2/ALB stack.

## Local run (optional)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL='postgresql+psycopg://user:pass@localhost:5432/attendance'
export SECRET_KEY='local-dev'
gunicorn -b 0.0.0.0:8080 wsgi:app
```

In AWS, instances load `DB_SECRET_ARN` from Secrets Manager and serve on port 8080.
