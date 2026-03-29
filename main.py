from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from vanna_setup import create_agent
from vanna.core.user.request_context import RequestContext
import sqlite3
import re
import os
import asyncio

app = FastAPI(title="NL2SQL Production API")

# =========================
# FRONTEND SERVING
# =========================
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def serve_index():
    return FileResponse("static/index.html")


# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Lazy Agent
# =========================
agent = None

def get_agent():
    global agent
    if agent is None:
        agent = create_agent()
    return agent

# =========================
# Request Schema
# =========================
class QueryRequest(BaseModel):
    question: str


# =========================
# SQL VALIDATION
# =========================
def validate_sql(sql):
    sql_upper = sql.upper().strip()

    if not sql_upper.startswith(("SELECT", "WITH")):
        raise ValueError("Only SELECT queries are allowed.")

    forbidden_keywords = [
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
        'EXEC', 'XP_', 'SP_', 'GRANT', 'REVOKE', 'SHUTDOWN'
    ]

    for kw in forbidden_keywords:
        if re.search(r'\b' + re.escape(kw) + r'\b', sql_upper):
            raise ValueError(f"Forbidden keyword detected: {kw}")

    if 'SQLITE_' in sql_upper:
        raise ValueError("System table access is forbidden.")


# =========================
# CLEAN SQL
# =========================
def clean_sql(text):
    text = text.strip()

    # Extract from code block
    code_block = re.search(r'```(?:\w+)?\s*(.*?)```', text, re.DOTALL)
    if code_block:
        return code_block.group(1).strip().rstrip(';')

    # Extract SELECT
    select_match = re.search(r'(SELECT\s.+)', text, re.DOTALL | re.IGNORECASE)
    if select_match:
        sql = select_match.group(1)
        sql = re.sub(r'```.*', '', sql)
        return sql.strip().rstrip(';')

    return text.strip().rstrip(';')


# =========================
# EXECUTE SQL
# =========================
def execute_sql(sql):
    conn = sqlite3.connect('clinic.db')
    cursor = conn.cursor()

    cursor.execute(sql)
    columns = [col[0] for col in cursor.description]
    rows = cursor.fetchall()

    conn.close()
    return columns, rows


# =========================
# SUMMARY BUILDER
# =========================
def build_summary(question, columns, rows):
    if not rows:
        return "No data found."

    if len(rows) == 1 and len(columns) == 1:
        return f"The answer is: {rows[0][0]}"

    return f"Found {len(rows)} results for: '{question}'"


# =========================
# PROMPT BUILDER
# =========================
def build_prompt(question, memory_examples=""):
    return f"""
You are an expert SQLite query generator.

STRICT RULES:
- Only generate valid SQLite SELECT queries
- Do NOT include explanations
- Do NOT include markdown
- Always return syntactically correct SQL

DATABASE SCHEMA:
patients(id, first_name, last_name, email, phone, date_of_birth, gender, city, registered_date)
doctors(id, name, specialization, department, phone)
appointments(id, patient_id, doctor_id, appointment_date, status, notes)
treatments(id, appointment_id, treatment_name, cost, duration_minutes)
invoices(id, patient_id, invoice_date, total_amount, paid_amount, status)

EXAMPLES:
{memory_examples}

QUESTION:
{question}

SQL:
"""


# =========================
# MEMORY FETCH
# =========================
async def get_memory_examples(agent, question):
    try:
        results = await agent.agent_memory.search(
            question=question,
            limit=2
        )

        examples = ""
        for r in results:
            examples += f"Q: {r.question}\nSQL: {r.args.get('sql')}\n\n"

        return examples

    except:
        return ""


# =========================
# GENERATE SQL WITH RETRY
# =========================
async def generate_sql(agent, request_context, prompt, retries=3):

    for attempt in range(retries):
        all_text = []

        async for component in agent.send_message(
            request_context=request_context,
            message=prompt
        ):
            sc = getattr(component, "simple_component", None)
            if sc and getattr(sc, "text", None):
                all_text.append(sc.text)

        full_response = "\n".join(all_text)

        if "select" in full_response.lower():
            return clean_sql(full_response)

    return None


# =========================
# MAIN API
# =========================
@app.post("/chat")
async def chat(request: QueryRequest, http_request: Request):

    if not request.question or len(request.question) < 3:
        raise HTTPException(status_code=400, detail="Invalid question.")

    try:
        agent = get_agent()

        request_context = RequestContext(
            headers=dict(http_request.headers),
            remote_addr=http_request.client.host if http_request.client else None
        )

        # 🔥 Inject memory examples
        memory_examples = await get_memory_examples(agent, request.question)

        prompt = build_prompt(request.question, memory_examples)

        # 🔁 Retry logic
        sql_query = await generate_sql(agent, request_context, prompt)

        if not sql_query:
            return {
                "message": "Unable to generate SQL. Try rephrasing.",
                "sql_query": None,
                "rows": []
            }

        # ✅ Validate
        validate_sql(sql_query)

        # ✅ Execute
        columns, rows = execute_sql(sql_query)

        return {
            "message": build_summary(request.question, columns, rows),
            "sql_query": sql_query,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows)
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        return {
            "message": "Internal error occurred. Try again.",
            "error": str(e)
        }


# =========================
# HEALTH CHECK
# =========================
@app.get("/health")
def health():
    try:
        conn = sqlite3.connect("clinic.db")
        conn.execute("SELECT 1")
        conn.close()

        return {
            "status": "ok",
            "database": "connected",
            "agent": "ready"
        }

    except:
        return {
            "status": "error",
            "database": "disconnected"
        }
