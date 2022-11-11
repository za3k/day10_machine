run-debug:
	flask --debug run
run-demo:
	gunicorn3 -e SCRIPT_NAME=/hackaday/machine --bind 0.0.0.0:8010 app:app
