from vanna_setup import create_agent
import asyncio


def seed_memory():
    print("Seeding memory with Q&A pairs...")

    # Initialize the agent when seeding (avoid import-time creation)
    agent = create_agent()

    qa_pairs = [

        # ======================
        # PATIENTS
        # ======================
        {
            "question": "How many patients do we have?",
            "sql": "SELECT COUNT(*) AS total_patients FROM patients"
        },
        {
            "question": "Which city has the most patients?",
            "sql": "SELECT city, COUNT(*) AS patient_count FROM patients GROUP BY city ORDER BY patient_count DESC LIMIT 1"
        },
        {
            "question": "List all female patients from Pune",
            "sql": "SELECT first_name, last_name, email FROM patients WHERE gender = 'F' AND city = 'Pune'"
        },
        {
            "question": "Show patient registration trend by month",
            "sql": """
            SELECT strftime('%Y-%m', registered_date) AS month,
                   COUNT(*) AS new_patients
            FROM patients
            GROUP BY month
            ORDER BY month
            """
        },
        {
            "question": "List patients who visited more than 3 times",
            "sql": """
            SELECT p.first_name, p.last_name, COUNT(*) AS visit_count
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            GROUP BY p.id
            HAVING visit_count > 3
            """
        },
        {
            "question": "Show patient count by city",
            "sql": """
            SELECT city, COUNT(*) AS total
            FROM patients
            GROUP BY city
            ORDER BY total DESC
            """
        },

        # ======================
        # DOCTORS
        # ======================
        {
            "question": "List all doctors and their specializations",
            "sql": "SELECT name, specialization FROM doctors"
        },
        {
            "question": "Which doctor has the most appointments?",
            "sql": """
            SELECT d.name, COUNT(*) AS appt_count
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            GROUP BY d.id
            ORDER BY appt_count DESC
            LIMIT 1
            """
        },
        {
            "question": "Show all doctors in OPD department",
            "sql": "SELECT name, phone FROM doctors WHERE department = 'OPD'"
        },

        # ======================
        # APPOINTMENTS
        # ======================
        {
            "question": "How many cancelled appointments last quarter?",
            "sql": """
            SELECT COUNT(*) AS cancelled_count
            FROM appointments
            WHERE status = 'Cancelled'
            AND appointment_date >= date('now', '-3 months')
            """
        },
        {
            "question": "What percentage of appointments are no-shows?",
            "sql": """
            SELECT (SUM(CASE WHEN status = 'No-Show' THEN 1 ELSE 0 END) * 100.0) / COUNT(*) AS noshow_percentage
            FROM appointments
            """
        },
        {
            "question": "Show the busiest day of the week for appointments",
            "sql": """
            SELECT strftime('%w', appointment_date) AS day_of_week,
                   COUNT(*) AS appt_count
            FROM appointments
            GROUP BY day_of_week
            ORDER BY appt_count DESC
            LIMIT 1
            """
        },
        {
            "question": "Show monthly appointment count for the past 6 months",
            "sql": """
            SELECT strftime('%Y-%m', appointment_date) AS month,
                   COUNT(*) AS appt_count
            FROM appointments
            WHERE appointment_date >= date('now', '-6 months')
            GROUP BY month
            ORDER BY month
            """
        },
        {
            "question": "Show appointments for last month",
            "sql": """
            SELECT *
            FROM appointments
            WHERE appointment_date >= date('now', '-1 month')
            """
        },

        # ======================
        # FINANCE
        # ======================
        {
            "question": "What is the total revenue?",
            "sql": "SELECT SUM(total_amount) AS total_revenue FROM invoices"
        },
        {
            "question": "Show revenue by doctor",
            "sql": """
            SELECT d.name, SUM(i.total_amount) AS total_revenue
            FROM invoices i
            JOIN patients p ON i.patient_id = p.id
            JOIN appointments a ON a.patient_id = p.id
            JOIN doctors d ON d.id = a.doctor_id
            GROUP BY d.id
            ORDER BY total_revenue DESC
            """
        },
        {
            "question": "Top 5 patients by spending",
            "sql": """
            SELECT p.first_name, p.last_name, SUM(i.total_amount) AS total_spending
            FROM invoices i
            JOIN patients p ON i.patient_id = p.id
            GROUP BY p.id
            ORDER BY total_spending DESC
            LIMIT 5
            """
        },
        {
            "question": "Average treatment cost by specialization",
            "sql": """
            SELECT d.specialization, AVG(t.cost) AS avg_cost
            FROM treatments t
            JOIN appointments a ON t.appointment_id = a.id
            JOIN doctors d ON a.doctor_id = d.id
            GROUP BY d.specialization
            """
        },
        {
            "question": "Show unpaid invoices",
            "sql": "SELECT * FROM invoices WHERE status IN ('Pending', 'Overdue')"
        },
        {
            "question": "How many unpaid invoices are there?",
            "sql": """
            SELECT COUNT(*) 
            FROM invoices 
            WHERE status != 'Paid'
            """
        }
    ]


    async def _seed():
        for i, pair in enumerate(qa_pairs):
            # DemoAgentMemory exposes an async `save_tool_usage` method.
            # We record the question, the tool used (`run_sql`) and the SQL args.
            await agent.agent_memory.save_tool_usage(
                question=pair["question"],
                tool_name="run_sql",
                args={"sql": pair["sql"]},
                context=None,
                success=True,
            )
            print(f"Added Pair {i+1}")

    asyncio.run(_seed())

    print("Memory seeding completed successfully!")


if __name__ == "__main__":
    seed_memory()