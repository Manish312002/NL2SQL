import os
from vanna import Agent, AgentConfig
from vanna.core.registry import ToolRegistry
from vanna.core.user import UserResolver, User, RequestContext
from vanna.tools import RunSqlTool, VisualizeDataTool
from vanna.tools.agent_memory import SaveQuestionToolArgsTool, SearchSavedCorrectToolUsesTool
from vanna.integrations.sqlite import SqliteRunner
from vanna.integrations.local.agent_memory import DemoAgentMemory
from dotenv import load_dotenv
from vanna.integrations.google import GeminiLlmService
from vanna.integrations.openai import OpenAILlmService
import re

load_dotenv()

class SafeSqliteRunner(SqliteRunner):
    def run_sql(self, sql: str, **kwargs):
        upper_sql = sql.upper().strip()
        
        # Validation rules:
        if not upper_sql.startswith(("SELECT", "WITH")):
            raise ValueError("Dangerous SQL Error: Only SELECT queries are allowed.")
            
        dangerous_keywords = [
            "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", 
            "EXEC", "XP_", "SP_", "GRANT", "REVOKE", "SHUTDOWN"
        ]
        
        # Word boundary search for dangerous keywords to avoid false positives (e.g. "DEPARTMENT" contains "PART")
        for kw in dangerous_keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', upper_sql):
                raise ValueError(f"Dangerous SQL Error: Keyword '{kw}' is not allowed.")
                
        if "SQLITE_" in upper_sql:
            raise ValueError("Dangerous SQL Error: System tables access is forbidden.")
            
        return super().run_sql(sql, **kwargs)

class DefaultUserResolver(UserResolver):
    async def resolve_user(self, context: RequestContext) -> User:
        return User(id="default_user", roles=[])

def create_agent():
    if os.getenv("GROQ_API_KEY"):
        llm = OpenAILlmService(
            base_url="https://api.groq.com/openai/v1", 
            api_key=os.getenv("GROQ_API_KEY"), 
            model="llama-3.3-70b-versatile"
        )
    elif os.getenv("GOOGLE_API_KEY"):
        llm = GeminiLlmService(
            api_key=os.getenv("GOOGLE_API_KEY"), 
            model="gemini-2.5-flash"
        )
    else:
        raise ValueError("No GROQ_API_KEY or GOOGLE_API_KEY found in .env file.")

    
    # ======================
    # DB RUNNER
    # ======================
    db_runner = SafeSqliteRunner("clinic.db")

    
    # ======================
    # TOOLS (USE LIST — MOST STABLE)
    # ======================
    tools = ToolRegistry()

    # Register tools (IMPORTANT)
    tools.register_local_tool(RunSqlTool(db_runner), access_groups=['admin', 'user'])
    tools.register_local_tool(VisualizeDataTool(), access_groups=['admin', 'user'])
    tools.register_local_tool(SaveQuestionToolArgsTool(), access_groups=['admin'])
    tools.register_local_tool(SearchSavedCorrectToolUsesTool(), access_groups=['admin', 'user'])

    # ======================
    # MEMORY
    # ======================
    agent_memory = DemoAgentMemory()


    # ======================
    # USER RESOLVER
    # ======================
    user_resolver = DefaultUserResolver()
    

    # ======================
    # AGENT (CORRECT INIT)
    # ======================
    agent = Agent(
        llm_service=llm,
        tool_registry=tools,
        user_resolver=user_resolver,
        agent_memory=agent_memory
    )

    return agent