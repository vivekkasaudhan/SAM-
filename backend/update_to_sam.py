import sqlite3

conn = sqlite3.connect('backend/aquasense.db')
c = conn.cursor()
c.execute("UPDATE users SET full_name = 'SAM Platform Administrator' WHERE id = 1")
c.execute("UPDATE sensors SET model = REPLACE(model, 'AquaSense', 'SAM')")
conn.commit()

c.execute("SELECT id, username, full_name FROM users WHERE id = 1")
print("Updated User:", c.fetchone())

c.execute("SELECT id, model FROM sensors WHERE model LIKE '%SAM%'")
print("Updated Sensors:", c.fetchall())

conn.close()
print("Database updated to SAM successfully.")
