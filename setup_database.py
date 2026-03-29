import sqlite3
import random
from datetime import datetime, timedelta
from faker import Faker

fake = Faker()
conn = sqlite3.connect('clinic.db')
c = conn.cursor()

def setup_database():
    # ========================
    # TABLE CREATION
    # ========================

    # 1. patients table
    c.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            date_of_birth DATE,
            gender TEXT,
            city TEXT,
            registered_date DATE
        )
    ''')

    # 2. doctors table
    c.execute('''
        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            specialization TEXT,
            department TEXT,
            phone TEXT
        )
    ''')
    
    # 3. appointments table
    c.execute('''
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            doctor_id INTEGER,
            appointment_date DATETIME,
            status TEXT,
            notes TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients (id),
            FOREIGN KEY (doctor_id) REFERENCES doctors (id)
        )
    ''')
    
    # 4. treatments table
    c.execute('''
        CREATE TABLE IF NOT EXISTS treatments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            appointment_id INTEGER,
            treatment_name TEXT,
            cost REAL,
            duration_minutes INTEGER,
            FOREIGN KEY (appointment_id) REFERENCES appointments (id)
        )
    ''')
    
    # 5. invoices table
    c.execute('''
        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            invoice_date DATE,
            total_amount REAL,
            paid_amount REAL,
            status TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients (id)
        )
    ''')
    conn.commit()

    # Data 

    cities = ["Pune", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Surat", "Jaipur", "Nashik", "Nagpur", "Indore", "Thane", "Bhopal"]
    statuses = ["Scheduled", "Completed", "Cancelled", "No-Show"]
    specializations = ["Dermatology", "Cardiology", "Orthopedics", "General", "Pediatrics"]
    departments = ["General Medicine", "Cardiology", "Orthopedics", "Dermatology", "Pediatrics", "Surgery", "Emergency"]
    # Map specializations to sensible departments
    spec_to_dept = {
        "Dermatology": "Dermatology",
        "Cardiology": "Cardiology",
        "Orthopedics": "Orthopedics",
        "General": "General Medicine",
        "Pediatrics": "Pediatrics",
    }
    
    # ========================
    # PATIENTS 200 Records
    # ========================
    for _ in range(200):
        fname = fake.first_name()
        lname = fake.last_name()
        email = fake.email() if random.random() > 0.3 else None
        phone = fake.phone_number() if random.random() > 0.2 else None
        dob = fake.date_of_birth(minimum_age=18, maximum_age=80).isoformat()
        gender = random.choice(['M', 'F'])
        city = random.choice(cities)
        reg_date = fake.date_between(start_date='-1y', end_date='today').isoformat()
        c.execute("""
        INSERT INTO patients (first_name, last_name, email, phone, date_of_birth, gender, city, registered_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (fname, lname, email, phone, dob, gender, city, reg_date))
    
    # ========================
    # DOCTORS 15 Records
    # ========================
    for _ in range(15):
        name = fake.name()
        specialist = random.choice(specializations)
        dept = spec_to_dept.get(specialist, random.choice(departments))
        phone = fake.phone_number()
        c.execute("""
        INSERT INTO doctors (name, specialization, department, phone)
        VALUES (?, ?, ?, ?)
        """, (name, specialist, dept, phone))


    # ========================
    # APPOINTMENTS 500 Records
    # ========================
    completed_appointments = []
    
    for _ in range(500):
        # We prefer lower patient IDs to simulate repeat patients
        pid = random.randint(1, 200) 
        doc_id = random.randint(1, 15)
        # Appointments spread across the last 12 months (0 to 365 days ago)
        appt_date = fake.date_time_between(start_date='-1y', end_date='now').isoformat()
        status = random.choice(statuses)
        r = random.random()
        notes = (
            "Patient complained about " + random.choice(["pain", "fever", "checkup", "follow-up"]) + ". " + fake.sentence(8)
            if r > 0.6
            else ("Routine visit. " + fake.sentence(5) if r > 0.3 else None)
        )

        c.execute("""
        INSERT INTO appointments (patient_id, doctor_id, appointment_date, status, notes) 
        VALUES (?, ?, ?, ?, ?)
        """, (pid, doc_id, appt_date, status, notes))

        appt_id = c.lastrowid
        if status == "Completed":
            completed_appointments.append(appt_id)

    # ========================
    # TREATMENTS 350 Records
    # ========================
    treatments_list = [
        ("Consultation", 50, 15),
        ("Blood Test", 100, 30),
        ("X-Ray", 250, 45),
        ("Physical Therapy", 300, 60),
        ("Surgery", 5000, 240),
        ("Skin Check", 150, 20),
        ("Vaccination", 75, 10),
        ("ECG", 200, 30),
        ("Cast applied", 400, 45)
    ]

    # 🎯 Realistic frequency (Surgery rare)
    treatment_weights = [30, 20, 10, 10, 2, 10, 8, 5, 5]

    # Ensure we have completed appointment IDs to attach treatments to.
    if not completed_appointments:
        c.execute("SELECT id FROM appointments WHERE status = 'Completed'")
        rows = c.fetchall()
        completed_appointments = [r[0] for r in rows]

    # Fallback: if still empty, use a range of existing appointment IDs
    if not completed_appointments:
        c.execute("SELECT COUNT(*) FROM appointments")
        appt_count = c.fetchone()[0]
        if appt_count > 0:
            completed_appointments = list(range(1, appt_count + 1))

    # Insert treatments (if there are any appointment IDs to associate)
    if completed_appointments:
        for _ in range(350):
            appt_id = random.choice(completed_appointments)
            chosen = random.choices(treatments_list, weights=treatment_weights, k=1)[0]
            t_name, t_cost, t_duration = chosen
            # jitter cost
            cost = t_cost * random.uniform(0.9, 1.2)
            c.execute("""
            INSERT INTO treatments (appointment_id, treatment_name, cost, duration_minutes) 
            VALUES (?, ?, ?, ?)
            """, (appt_id, t_name, round(cost, 2), t_duration))

    # ========================
    # INVOICES 300 Records
    # ========================
    invoice_statuses = ["Paid", "Pending", "Overdue"]
    for _ in range(300):
        pid = random.randint(1, 200)
        inv_date = fake.date_between(start_date='-1y', end_date='today').isoformat()
        status = random.choice(invoice_statuses)
        tot_amt = round(random.uniform(50.0, 5000.0), 2)

        if status == "Paid":
            paid_amt = tot_amt
        elif status == "Overdue":
            paid_amt = 0.0
        else: # Pending
            paid_amt = round(tot_amt * random.choice([0, 0.5]), 2)
            
        c.execute("""
        INSERT INTO invoices (patient_id, invoice_date, total_amount, paid_amount, status) 
        VALUES (?, ?, ?, ?, ?)
        """, (pid, inv_date, tot_amt, paid_amt, status))
        
    conn.commit()
    conn.close()

    print("Created 200 patients, 15 doctors, 500 appointments, 350 treatments, and 300 invoices.")

if __name__ == '__main__':
    setup_database()
