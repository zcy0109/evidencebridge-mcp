import os

bind = os.getenv("GUNICORN_BIND", "127.0.0.1:5001")
workers = int(os.getenv("GUNICORN_WORKERS", "2"))
threads = int(os.getenv("GUNICORN_THREADS", "4"))
timeout = int(os.getenv("GUNICORN_TIMEOUT", "30"))
graceful_timeout = 10
accesslog = "-"
errorlog = "-"
capture_output = True
