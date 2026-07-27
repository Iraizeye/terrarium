# RANGEWATCH — one-command runs.
#
#   make demo    full dashboard on a scripted synthetic day (no config, no
#                personal data; a compressed 24h session loops every 5 min)
#   make dev     dashboard against the real machine (range-trader, Claude, vitals)
#   make test    backend test suite

VENV := backend/.venv
PY   := $(VENV)/bin/python

$(VENV)/bin/uvicorn: backend/requirements.txt
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install -q -r backend/requirements.txt

frontend/node_modules: frontend/package.json
	cd frontend && npm install

.PHONY: demo dev test

demo: $(VENV)/bin/uvicorn frontend/node_modules
	@echo "RANGEWATCH demo -> http://127.0.0.1:3000  (Ctrl-C stops both)"
	@trap 'kill 0' INT TERM; \
	RANGEWATCH_DEMO=1 $(VENV)/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000 & \
	(cd frontend && npm run dev) & \
	wait

dev: $(VENV)/bin/uvicorn frontend/node_modules
	@trap 'kill 0' INT TERM; \
	$(VENV)/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000 & \
	(cd frontend && npm run dev) & \
	wait

test: $(VENV)/bin/uvicorn
	$(VENV)/bin/pip install -q pytest httpx
	$(PY) -m pytest backend/tests/ -q
