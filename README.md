# NL2SQL — AI-Powered Natural Language to SQL System

A FastAPI application that converts natural-language questions into SQL queries using **Vanna AI 2.0** and executes them against a SQLite clinic database. Includes a **modern, premium web-based chat interface** with auto-rendered charts and SQL syntax highlighting.

## Architecture Overview

```
User Question (English)
        |
        v
   FastAPI Backend (/chat endpoint)
        |
        v
   Vanna 2.0 Agent
   (LlmService + Tools + DemoAgentMemory)
        |
        v
   SQL Validation (SELECT only, no dangerous queries)
        |
        v
   Database Execution (SQLite via SafeSqliteRunner)
        |
        v
   Results + Summary + Chart returned to user
```

**LLM Providers Supported:** 
- Groq (`llama-3.3-70b-versatile`) — *Preferred if both keys are provided*
- Google Gemini (`gemini-2.5-flash`)

## Quick Setup

### 1. Create and activate a Python virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure your API key

Create a `.env` file in the project root and add ONE (or both) of the following keys:

```
# Primary (Faster/Better SQL generation)
GROQ_API_KEY=your-groq-api-key-here

# Secondary Fallback
GOOGLE_API_KEY=your-gemini-api-key-here
```

Get a free key at: 
- Groq: https://console.groq.com/keys
- Google GenAI: https://aistudio.google.com/apikey

### 4. Create and seed the database

```bash
python setup_database.py
```

Output: `Created 200 patients, 15 doctors, 500 appointments, 350 treatments, and 300 invoices.`

### 5. Seed the agent memory

```bash
python seed_memory.py
```

This loads 20 known-good Q&A pairs into the agent's memory so the LLM has reference examples.

### 6. Run the Application

```bash
uvicorn main:app --port 8000
```

Once running, **open your browser to [http://localhost:8000](http://localhost:8000)** to view the premium web interface.

## Web Interface Features

- **Dark Glassmorphism Theme**: Modern aesthetics with animated background orbs.
- **Auto-Rendered Charts**: Intelligent Plotly visualization of multi-row data.
- **SQL Syntax Highlighting**: Color-coded generation of backend queries.
- **Quick Questions**: One-click sidebar prompts for common clinic queries.

## API Documentation

### POST /chat

Send a natural language question and get SQL results.

**Request:**
```json
{
  "question": "Show me the top 5 patients by total spending"
}
```

**Response:**
```json
{
  "message": "Found 5 results for: \"Show me the top 5 patients by total spending\"",
  "sql_query": "SELECT p.first_name, p.last_name, SUM(i.total_amount) AS total_spending FROM invoices i JOIN patients p ON i.patient_id = p.id GROUP BY p.id ORDER BY total_spending DESC LIMIT 5",
  "columns": ["first_name", "last_name", "total_spending"],
  "rows": [["John", "Smith", 4500], ["Jane", "Doe", 3200]],
  "row_count": 5
}
```

### GET /health

Check system health.

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "agent": "ready"
}
```

## Running Tests

Run the 20 benchmark questions:

```bash
# Make sure the server is running first
uvicorn main:app --port 8000

# In another terminal
python test_queries.py
```

Results are written to `RESULTS.md`.

## Project Structure

```
NL2SQL/
├── main.py              # FastAPI application & API endpoints
├── vanna_setup.py       # Vanna 2.0 Agent initialization
├── setup_database.py    # Database creation + dummy data
├── seed_memory.py       # Agent memory seeding
├── static/              # Frontend web assets
│   ├── index.html       # Chat interface UI
│   ├── style.css        # Premium dark theme styling
│   └── app.js           # Frontend logic & chart rendering
├── requirements.txt     # Dependencies
├── .env                 # API key (not committed)
├── clinic.db            # SQLite database (generated)
├── RESULTS.md           # Test results
└── README.md            # This file
```

## Security

- SQL validation prevents non-SELECT queries
- Word-boundary keyword matching avoids false positives
- System table access is blocked
- API keys loaded from environment variables

