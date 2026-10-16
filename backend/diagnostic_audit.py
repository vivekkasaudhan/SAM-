import sqlite3
from datetime import datetime

conn = sqlite3.connect('backend/aquasense.db')
cur = conn.cursor()

print('=== 1. TOTAL READINGS & WELLS ===')
cur.execute('SELECT COUNT(*) FROM readings')
total_readings = cur.fetchone()[0]
cur.execute('SELECT COUNT(*) FROM wells')
total_wells = cur.fetchone()[0]
print(f'Total readings: {total_readings}, Total wells: {total_wells}')

print('\n=== 2. WELL TABLE SCHEMA ===')
cur.execute("PRAGMA table_info(wells)")
for col in cur.fetchall():
    print(col)

print('\n=== 3. READINGS TABLE SCHEMA ===')
cur.execute("PRAGMA table_info(readings)")
for col in cur.fetchall():
    print(col)

print('\n=== 4. READINGS GROUPED BY STATUS & SOURCE ===')
cur.execute('SELECT status, source, count(*) FROM readings GROUP BY status, source')
for row in cur.fetchall():
    print(f'Status: {row[0]}, Source: {row[1]}, Count: {row[2]}')

print('\n=== 5. ORPHANED READINGS ===')
cur.execute('SELECT count(*) FROM readings WHERE well_id NOT IN (SELECT id FROM wells)')
orphans = cur.fetchone()[0]
print(f'Orphaned readings count: {orphans}')

print('\n=== 6. READING COUNTS PER WELL ===')
cur.execute('''
    SELECT w.id, w.name, w.monitoring_type, count(r.id) as r_count,
           min(r.timestamp) as min_ts, max(r.timestamp) as max_ts
    FROM wells w
    LEFT JOIN readings r ON w.id = r.well_id
    GROUP BY w.id
    ORDER BY r_count DESC
''')
all_well_stats = cur.fetchall()

wells_under_24h = 0
wells_1y = 0
wells_2y = 0
wells_3y = 0

for w in all_well_stats:
    r_count = w[3]
    min_ts_str = w[4]
    max_ts_str = w[5]
    span_days = 0
    if min_ts_str and max_ts_str:
        try:
            d_min = datetime.fromisoformat(min_ts_str.replace('Z', ''))
            d_max = datetime.fromisoformat(max_ts_str.replace('Z', ''))
            span_days = (d_max - d_min).total_seconds() / 86400.0
        except Exception:
            span_days = 0

    if span_days < 1.0 or r_count < 10:
        wells_under_24h += 1
    if span_days >= 365:
        wells_1y += 1
    if span_days >= 730:
        wells_2y += 1
    if span_days >= 1000:
        wells_3y += 1

print(f'Total wells: {len(all_well_stats)}')
print(f'Wells with < 24 hours of data (or < 10 readings): {wells_under_24h}')
print(f'Wells with >= 1 year span: {wells_1y}')
print(f'Wells with >= 2 years span: {wells_2y}')
print(f'Wells with >= 3 years span: {wells_3y}')

print('\nAll wells summary:')
for w in all_well_stats:
    print(f'{w[0]:15} | {w[1][:32]:32} | type={w[2]:10} | count={w[3]:6} | {w[4]} -> {w[5]}')

print('\n=== 7. DUPLICATE TIMESTAMPS CHECK ===')
cur.execute('''
    SELECT well_id, timestamp, count(*) as c
    FROM readings
    GROUP BY well_id, timestamp
    HAVING c > 1
''')
dup_rows = cur.fetchall()
print(f'Duplicate (well_id, timestamp) occurrences: {len(dup_rows)}')
if dup_rows:
    for row in dup_rows[:5]:
        print(f'Duplicate: well_id={row[0]}, timestamp={row[1]}, count={row[2]}')

print('\n=== 8. CHECK WELL-8D2930 vs WELL-4B9B77 ===')
cur.execute("SELECT id, name, created_at, created_by, state, city FROM wells WHERE id IN ('WELL-8D2930', 'WELL-4B9B77')")
for row in cur.fetchall():
    print(row)

cur.execute("SELECT well_id, count(*), min(timestamp), max(timestamp) FROM readings WHERE well_id IN ('WELL-8D2930', 'WELL-4B9B77') GROUP BY well_id")
for row in cur.fetchall():
    print(row)

cur.execute("SELECT id, name, count(*) FROM wells WHERE name LIKE '%Subadmin 1 Hydro Station%' GROUP BY id")
for row in cur.fetchall():
    print(row)

conn.close()
