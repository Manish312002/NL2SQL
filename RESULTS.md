# NL2SQL — Test Results

**Score: 20/20 passed** (0 failed)

---

## 1. How many patients do we have?
**Expected Behavior:** Returns count
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT COUNT(id) FROM patients
```
**Rows returned:** 1
**Summary:** The answer is: 200

---

## 2. List all doctors and their specializations
**Expected Behavior:** Returns doctor list
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT name, specialization FROM doctors
```
**Rows returned:** 15
**Summary:** Found 15 results for: 'List all doctors and their specializations'

---

## 3. Show me appointments for last month
**Expected Behavior:** Filters by date
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT * FROM appointments WHERE STRFTIME('%Y-%m', appointment_date) = STRFTIME('%Y-%m', DATE('now', '-1 month'))
```
**Rows returned:** 36
**Summary:** Found 36 results for: 'Show me appointments for last month'

---

## 4. Which doctor has the most appointments?
**Expected Behavior:** Aggregation + ordering
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT T1.name FROM doctors AS T1 INNER JOIN appointments AS T2 ON T1.id = T2.doctor_id GROUP BY T2.doctor_id ORDER BY COUNT(T2.id) DESC LIMIT 1
```
**Rows returned:** 1
**Summary:** The answer is: Lauren Sanders

---

## 5. What is the total revenue?
**Expected Behavior:** SUM of invoice amounts
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT SUM(total_amount) FROM invoices
```
**Rows returned:** 1
**Summary:** The answer is: 794210.72

---

## 6. Show revenue by doctor
**Expected Behavior:** JOIN + GROUP BY
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT T2.name, SUM(T4.total_amount) AS revenue 
FROM patients AS T1 
INNER JOIN appointments AS T3 ON T1.id = T3.patient_id 
INNER JOIN doctors AS T2 ON T3.doctor_id = T2.id 
INNER JOIN invoices AS T4 ON T1.id = T4.patient_id 
GROUP BY T2.name
```
**Rows returned:** 15
**Summary:** Found 15 results for: 'Show revenue by doctor'

---

## 7. How many cancelled appointments last quarter?
**Expected Behavior:** Status filter + date
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT COUNT(*) FROM appointments WHERE status = 'cancelled' AND appointment_date BETWEEN DATE('now', '-3 months') AND DATE('now')
```
**Rows returned:** 1
**Summary:** The answer is: 0

---

## 8. Top 5 patients by spending
**Expected Behavior:** JOIN + ORDER + LIMIT
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT p.first_name, p.last_name, SUM(i.total_amount) as total_spent 
FROM patients p 
JOIN invoices i ON p.id = i.patient_id 
GROUP BY p.id 
ORDER BY total_spent DESC 
LIMIT 5
```
**Rows returned:** 5
**Summary:** Found 5 results for: 'Top 5 patients by spending'

---

## 9. Average treatment cost by specialization
**Expected Behavior:** Multi-table JOIN + AVG
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT T2.specialization, AVG(T1.cost) AS avg_cost FROM treatments AS T1 INNER JOIN appointments AS T3 ON T1.appointment_id = T3.id INNER JOIN doctors AS T2 ON T3.doctor_id = T2.id GROUP BY T2.specialization
```
**Rows returned:** 5
**Summary:** Found 5 results for: 'Average treatment cost by specialization'

---

## 10. Show monthly appointment count for the past 6 months
**Expected Behavior:** Date grouping
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT 
    STRFTIME('%Y-%m', appointment_date) AS month,
    COUNT(*) AS appointment_count
FROM 
    appointments
WHERE 
    appointment_date > DATE('now', '-6 months')
GROUP BY 
    STRFTIME('%Y-%m', appointment_date)
ORDER BY 
    month DESC
```
**Rows returned:** 7
**Summary:** Found 7 results for: 'Show monthly appointment count for the past 6 months'

---

## 11. Which city has the most patients?
**Expected Behavior:** GROUP BY + COUNT
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT city FROM patients GROUP BY city ORDER BY COUNT(id) DESC LIMIT 1
```
**Rows returned:** 1
**Summary:** The answer is: Bhopal

---

## 12. List patients who visited more than 3 times
**Expected Behavior:** HAVING clause
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT p.id, p.first_name, p.last_name 
FROM patients p
JOIN appointments a ON p.id = a.patient_id
GROUP BY p.id, p.first_name, p.last_name
HAVING COUNT(a.id) > 3
```
**Rows returned:** 45
**Summary:** Found 45 results for: 'List patients who visited more than 3 times'

---

## 13. Show unpaid invoices
**Expected Behavior:** Status filter
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT * FROM invoices WHERE paid_amount < total_amount AND status = 'unpaid'
```
**Rows returned:** 0
**Summary:** No data found.

---

## 14. What percentage of appointments are no-shows?
**Expected Behavior:** Percentage calculation
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT CAST(SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) AS REAL) * 100 / COUNT(*) FROM appointments
```
**Rows returned:** 1
**Summary:** The answer is: 0.0

---

## 15. Show the busiest day of the week for appointments
**Expected Behavior:** Date function
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT strftime('%W', appointment_date) AS day_of_week, COUNT(*) AS count 
FROM appointments 
GROUP BY strftime('%W', appointment_date) 
ORDER BY count DESC 
LIMIT 1
```
**Rows returned:** 1
**Summary:** Found 1 results for: 'Show the busiest day of the week for appointments'

---

## 16. Revenue trend by month
**Expected Behavior:** Time series
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT STRFTIME('%Y-%m', invoice_date) AS month, SUM(total_amount) AS revenue 
FROM invoices 
GROUP BY STRFTIME('%Y-%m', invoice_date) 
ORDER BY month
```
**Rows returned:** 13
**Summary:** Found 13 results for: 'Revenue trend by month'

---

## 17. Average appointment duration by doctor
**Expected Behavior:** AVG + GROUP BY
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT T1.name, AVG(T3.duration_minutes) AS average_duration FROM doctors AS T1 INNER JOIN appointments AS T2 ON T1.id = T2.doctor_id INNER JOIN treatments AS T3 ON T2.id = T3.appointment_id GROUP BY T1.name
```
**Rows returned:** 15
**Summary:** Found 15 results for: 'Average appointment duration by doctor'

---

## 18. List patients with overdue invoices
**Expected Behavior:** JOIN + filter
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT p.id, p.first_name, p.last_name, i.id, i.invoice_date, i.total_amount, i.paid_amount 
FROM patients p 
JOIN invoices i ON p.id = i.patient_id 
WHERE i.status = 'overdue' OR i.paid_amount < i.total_amount
```
**Rows returned:** 186
**Summary:** Found 186 results for: 'List patients with overdue invoices'

---

## 19. Compare revenue between departments
**Expected Behavior:** JOIN + GROUP BY
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT d.department, SUM(t.cost) AS revenue 
FROM treatments t 
JOIN appointments a ON t.appointment_id = a.id 
JOIN doctors d ON a.doctor_id = d.id 
GROUP BY d.department
```
**Rows returned:** 5
**Summary:** Found 5 results for: 'Compare revenue between departments'

---

## 20. Show patient registration trend by month
**Expected Behavior:** Date grouping
**Status:** ✅ PASS

**Generated SQL:**
```sql
SELECT STRFTIME('%Y-%m', registered_date) AS registration_month, COUNT(id) AS number_of_patients FROM patients GROUP BY STRFTIME('%Y-%m', registered_date) ORDER BY registration_month
```
**Rows returned:** 13
**Summary:** Found 13 results for: 'Show patient registration trend by month'

---

## Summary

| Metric | Value |
|--------|-------|
| Total Questions | 20 |
| Passed | 20 |
| Failed | 0 |
| Success Rate | 100.0% |
