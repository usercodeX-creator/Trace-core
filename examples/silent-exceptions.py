# Intentional demo of silent exception anti-patterns
# DO NOT copy these patterns into real code

import requests

def fetch_user(user_id):
    # Pattern A: bare except with pass — critical
    try:
        response = requests.get(f"/users/{user_id}")
        return response.json()
    except:
        pass


def validate_payment(amount):
    # Pattern B: except Exception: pass — high
    try:
        check_fraud_signals(amount)
    except Exception:
        pass


def log_event(event):
    # Pattern D: print-only — medium
    try:
        send_to_analytics(event)
    except Exception as e:
        print(e)
